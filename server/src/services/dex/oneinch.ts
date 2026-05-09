/**
 * 1inch DEX Aggregator — crypto-to-crypto swap quotes.
 *
 * Uses the 1inch Aggregation Protocol v5.2. Quotes are READ-ONLY — no wallet
 * signing happens here. The actual on-chain swap is executed by the
 * onchainSettlement service using the user's derived private key.
 *
 * Chains supported: Ethereum (1), BNB Chain (56), Polygon (137), Avalanche (43114).
 * Set ONEINCH_API_KEY in .env for the portal.1inch.dev dev key (higher rate limits).
 */

import axios from 'axios';

export type ChainId = 1 | 56 | 137 | 43114;

/** Well-known token addresses (lowercase) per chain */
const TOKEN_MAP: Record<number, Record<string, string>> = {
  1: {
    ETH:  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    DAI:  '0x6b175474e89094c44da98b954eedeac495271d0f',
    LINK: '0x514910771af9ca656af840dff83e8264ecf986ca',
    UNI:  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    AAVE: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    MATIC:'0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
  },
  56: {
    BNB:  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    USDT: '0x55d398326f99059ff775485246999027b3197955',
    USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    ETH:  '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
    BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
  },
  137: {
    MATIC:'0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    WMATIC:'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    WETH: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
  },
  43114: {
    AVAX: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    WAVAX:'0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    USDT: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
    USDC: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
    WETH: '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
  },
};

export interface DexQuoteParams {
  fromToken: string;   // symbol e.g. "ETH"
  toToken: string;     // symbol e.g. "USDT"
  amount: string;      // in fromToken native units (wei for ETH)
  chainId?: ChainId;
  slippage?: number;   // percent, default 1
}

export interface DexQuoteResult {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedGas: number;
  protocols: string[];
  chainId: number;
  priceImpact?: number;
}

function resolveAddress(symbol: string, chainId: number): string {
  const map = TOKEN_MAP[chainId] ?? TOKEN_MAP[1];
  const addr = map[symbol.toUpperCase()];
  if (!addr) throw new Error(`Unknown token symbol "${symbol}" on chain ${chainId}. Pass a raw address instead.`);
  return addr;
}

function buildHeaders(): Record<string, string> {
  const key = process.env.ONEINCH_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/** Get a DEX swap quote. Returns the best route across all aggregated DEXes. */
export async function getDexQuote(params: DexQuoteParams): Promise<DexQuoteResult> {
  const chainId = params.chainId ?? 1;
  const src = params.fromToken.startsWith('0x')
    ? params.fromToken
    : resolveAddress(params.fromToken, chainId);
  const dst = params.toToken.startsWith('0x')
    ? params.toToken
    : resolveAddress(params.toToken, chainId);

  const { data } = await axios.get(
    `https://api.1inch.dev/swap/v5.2/${chainId}/quote`,
    {
      params: { src, dst, amount: params.amount },
      headers: buildHeaders(),
      timeout: 8_000,
    },
  );

  const protocols: string[] = (data.protocols ?? [])
    .flat(3)
    .map((p: any) => p?.name ?? '')
    .filter(Boolean)
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

  return {
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: data.fromTokenAmount ?? params.amount,
    toAmount: data.toTokenAmount,
    estimatedGas: data.estimatedGas ?? 0,
    protocols,
    chainId,
  };
}

/** Supported chain IDs for the DEX */
export const SUPPORTED_CHAINS: Record<string, ChainId> = {
  ETH: 1,
  BNB: 56,
  POLYGON: 137,
  AVAX: 43114,
};
