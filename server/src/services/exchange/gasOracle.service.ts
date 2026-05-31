/**
 * Live network-fee oracle.
 *
 * The static FEES.network table in priceEngine is only an estimate. When real
 * gas or slippage spikes above it, a quote built on the static value
 * undercharges and eats the platform's margin. This oracle fetches the *live*
 * on-chain cost at quote time and returns it in USD so the quote builder can
 * charge at least the real cost.
 *
 * Design for safety:
 *   - Every lookup is cached (15s) and wrapped so a failing/slow provider can
 *     never block or crash a quote.
 *   - On any failure we return `null`; the caller falls back to the static
 *     table. The effective fee is always `max(static, live)`, so the oracle
 *     can only ever *raise* the fee toward the true cost — never lower it
 *     below the configured floor.
 */
import axios from 'axios';
import Decimal from 'decimal.js';
import { getMarketPrice } from './priceEngine.service';

// Typical gas units for a transfer on each EVM chain. Native sends are ~21k;
// ERC-20 token transfers are ~65k. These are deliberately generous so the
// estimated cost errs on the side of protecting margin.
const EVM_GAS_UNITS: Record<string, number> = {
  ETH_NATIVE: 21_000,
  ERC20:      65_000,
};

// Maps our network keys to an EVM chain + whether the asset is the native coin
// or an ERC-20-style token transfer on that chain.
type EvmChain = { rpcUrl: string; nativeSymbol: string; isToken: boolean };

function evmChainFor(networkKey: string): EvmChain | null {
  const alchemy = process.env.ALCHEMY_RPC_URL;
  // Ethereum mainnet (native ETH + all *_ERC20 tokens).
  const ethRpc = alchemy || 'https://eth.llamarpc.com';
  if (networkKey === 'ETH_ERC20' || networkKey === 'ETH') {
    return { rpcUrl: ethRpc, nativeSymbol: 'ETH', isToken: false };
  }
  if (networkKey.endsWith('_ERC20')) {
    return { rpcUrl: ethRpc, nativeSymbol: 'ETH', isToken: true };
  }
  return null;
}

const cache = new Map<string, { usd: Decimal | null; exp: number }>();
const TTL_MS = 15_000;

async function rpcGasPriceWei(rpcUrl: string): Promise<Decimal | null> {
  try {
    const { data } = await axios.post(
      rpcUrl,
      { jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] },
      { timeout: 4000 },
    );
    const hex = data?.result;
    if (typeof hex !== 'string') return null;
    return new Decimal(parseInt(hex, 16));
  } catch {
    return null;
  }
}

/**
 * Returns the live network cost in USD for sending `asset` on `networkKey`,
 * or `null` if it can't be determined (caller falls back to the static fee).
 */
export async function liveNetworkCostUsd(networkKey: string): Promise<Decimal | null> {
  const hit = cache.get(networkKey);
  if (hit && hit.exp > Date.now()) return hit.usd;

  let usd: Decimal | null = null;
  try {
    const chain = evmChainFor(networkKey);
    if (chain) {
      const gasPriceWei = await rpcGasPriceWei(chain.rpcUrl);
      if (gasPriceWei) {
        const units = chain.isToken ? EVM_GAS_UNITS.ERC20 : EVM_GAS_UNITS.ETH_NATIVE;
        // cost in native coin = gasPrice(wei) * units / 1e18
        const nativeCost = gasPriceWei.mul(units).div(new Decimal(10).pow(18));
        const nativePrice = await getMarketPrice(`${chain.nativeSymbol}USDT`);
        usd = nativeCost.mul(nativePrice);
      }
    }
    // Non-EVM chains (BTC, SOL, XRP, …) have no cheap live oracle here yet;
    // returning null keeps them on the static table.
  } catch {
    usd = null;
  }

  cache.set(networkKey, { usd, exp: Date.now() + TTL_MS });
  return usd;
}
