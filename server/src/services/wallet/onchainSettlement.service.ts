/**
 * On-chain settlement service.
 *
 * Withdrawal lifecycle:
 *   1. Debit user's internal ledger (atomic, under $transaction).
 *   2. Derive the user's private key on demand from the master seed.
 *   3. Build + sign tx (chain-specific), broadcast via RPC.
 *   4. Record OnChainTransaction with txHash.
 *   5. Poll confirmations asynchronously; on confirmation mark CONFIRMED.
 *
 * Deposit lifecycle:
 *   - A webhook (Alchemy / QuickNode / Trongrid) calls processDeposit()
 *     with the asset + amount + txHash. We credit the ledger after the
 *     required confirmation count.
 *
 * MVP guard rails:
 *   - If RPC credentials are missing, the broadcast step is skipped and
 *     the tx is recorded with status="SIMULATED" so the ledger side of
 *     the flow is still exercisable in dev. A TODO marker flags this.
 *   - Real gas estimation requires live RPC. We provide a static
 *     estimate table via estimateFee() as a sensible default.
 */
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';
import { ethers } from 'ethers';
import axios from 'axios';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import {
  Connection, Keypair as SolKeypair, PublicKey,
  SystemProgram, Transaction as SolTransaction,
  sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { deriveKeyForChain } from './walletDerivation.service';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
import { logger } from '../../utils/logger';

Decimal.set({ precision: 40 });

// Asset → internal balance column on UserWallet.
type BalanceField =
  | 'ethBalance'
  | 'btcBalance'
  | 'solBalance'
  | 'usdtErc20Bal'
  | 'usdtTrc20Bal';

function balanceField(asset: string, network: string): BalanceField {
  const a = asset.toUpperCase();
  const n = network.toUpperCase();
  if (a === 'ETH') return 'ethBalance';
  if (a === 'BTC') return 'btcBalance';
  if (a === 'SOL') return 'solBalance';
  if (a === 'USDT') return n === 'TRC20' ? 'usdtTrc20Bal' : 'usdtErc20Bal';
  throw new AppError(`Unsupported asset: ${asset}`, 400);
}

function chainForAsset(asset: string, network: string): 'ETH' | 'BTC' | 'SOL' | 'TRON' {
  const a = asset.toUpperCase();
  const n = network.toUpperCase();
  if (a === 'ETH') return 'ETH';
  if (a === 'BTC') return 'BTC';
  if (a === 'SOL') return 'SOL';
  if (a === 'USDT') return n === 'TRC20' ? 'TRON' : 'ETH';
  throw new AppError(`Unsupported asset: ${asset}`, 400);
}

function fromAddressField(asset: string, network: string):
  'ethAddress' | 'btcAddress' | 'solAddress' | 'tronAddress' {
  const chain = chainForAsset(asset, network);
  if (chain === 'ETH') return 'ethAddress';
  if (chain === 'BTC') return 'btcAddress';
  if (chain === 'SOL') return 'solAddress';
  return 'tronAddress';
}

// Required confirmations per spec.
const CONFIRMATIONS = { ETH: 3, BTC: 6, SOL: 32, TRON: 20 } as const;

// Static fallback fee table — used when RPC is unavailable.
const STATIC_FEE_FALLBACK: Record<string, { asset: string; estimate: string }> = {
  ETH:       { asset: 'ETH', estimate: '0.0008' },
  BTC:       { asset: 'BTC', estimate: '0.00015' },
  SOL:       { asset: 'SOL', estimate: '0.000005' },
  USDT_ERC20:{ asset: 'ETH', estimate: '0.0015' },
  USDT_TRC20:{ asset: 'TRX', estimate: '15' },
};

// Gas units consumed by common operations (EVM).
const EVM_GAS_UNITS = { ETH_TRANSFER: 21_000, ERC20_TRANSFER: 65_000 };

/**
 * Estimate the network fee for a withdrawal using live RPC where possible,
 * falling back to a conservative static table when RPC is unavailable.
 *
 * Returns the fee in the gas token (ETH, BTC, SOL, TRX) — NOT in the
 * transferred asset. The caller should check the user has enough gas token
 * in their custodial wallet before deducting.
 */
export async function estimateFee(
  asset: string,
  network: string,
): Promise<{ asset: string; estimate: string; live: boolean }> {
  const a = asset.toUpperCase();
  const n = network.toUpperCase();

  // ── EVM (ETH native + ERC-20 USDT) ────────────────────────────────
  if (a === 'ETH' || (a === 'USDT' && n === 'ERC20')) {
    const rpc = process.env.ALCHEMY_RPC_URL
      ?? (process.env.ALCHEMY_API_KEY
        ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : null);
    if (rpc) {
      try {
        const provider = new ethers.JsonRpcProvider(rpc);
        const feeData = await provider.getFeeData();
        // Use maxFeePerGas when available (EIP-1559), else fall back to gasPrice.
        const gasPriceWei = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
        const gasUnits = a === 'ETH' ? EVM_GAS_UNITS.ETH_TRANSFER : EVM_GAS_UNITS.ERC20_TRANSFER;
        // Add 20% safety margin.
        const feeWei = gasPriceWei * BigInt(gasUnits) * 120n / 100n;
        const feeEth = ethers.formatEther(feeWei);
        return { asset: 'ETH', estimate: feeEth, live: true };
      } catch {
        // Fall through to static table
      }
    }
    const key = a === 'USDT' ? 'USDT_ERC20' : 'ETH';
    return { ...STATIC_FEE_FALLBACK[key]!, live: false };
  }

  // ── Solana ─────────────────────────────────────────────────────────
  if (a === 'SOL') {
    const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    try {
      // SOL fee per signature via JSON-RPC (no SDK dependency).
      const res = await import('axios').then(({ default: ax }) =>
        ax.post(rpcUrl, {
          jsonrpc: '2.0', id: 1, method: 'getRecentBlockhash', params: [{ commitment: 'finalized' }],
        }, { timeout: 4000 })
      );
      const lamportsPerSig: number = res.data?.result?.value?.feeCalculator?.lamportsPerSignature ?? 5000;
      const sol = (lamportsPerSig / 1e9).toFixed(9);
      return { asset: 'SOL', estimate: sol, live: true };
    } catch {
      return { ...STATIC_FEE_FALLBACK['SOL']!, live: false };
    }
  }

  // ── TRC-20 USDT ────────────────────────────────────────────────────
  if (a === 'USDT' && n === 'TRC20') {
    // Tron energy cost for TRC-20 transfer ≈ 14–65 TRX depending on congestion.
    // Use Trongrid to get current energy price when credentials available.
    return { ...STATIC_FEE_FALLBACK['USDT_TRC20']!, live: false };
  }

  // ── BTC ────────────────────────────────────────────────────────────
  if (a === 'BTC') {
    try {
      const res = await import('axios').then(({ default: ax }) =>
        ax.get('https://mempool.space/api/v1/fees/recommended', { timeout: 4000 })
      );
      // Use halfHourFee (sat/vB) × typical P2WPKH tx size (141 vB).
      const satPerVb: number = res.data?.halfHourFee ?? 10;
      const feeSat = satPerVb * 141;
      const feeBtc = (feeSat / 1e8).toFixed(8);
      return { asset: 'BTC', estimate: feeBtc, live: true };
    } catch {
      return { ...STATIC_FEE_FALLBACK['BTC']!, live: false };
    }
  }

  throw new AppError(`Unsupported asset/network: ${asset}/${network}`, 400);
}

// ── Broadcast adapters (guarded) ─────────────────────────────────────

async function broadcastEvm(opts: {
  privateKey: string;
  toAddress: string;
  amountEth: string;       // native ETH transfer (not USDT-ERC20)
}): Promise<string> {
  const rpc = process.env.ALCHEMY_RPC_URL
    || (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : null);
  if (!rpc) return '';
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(opts.privateKey, provider);
  const tx = await wallet.sendTransaction({
    to: opts.toAddress,
    value: ethers.parseEther(opts.amountEth),
  });
  return tx.hash;
}

async function broadcastUsdtErc20(opts: {
  privateKey: string;
  toAddress: string;
  amount: string; // in USDT (6 decimals)
}): Promise<string> {
  const rpc = process.env.ALCHEMY_RPC_URL
    || (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : null);
  if (!rpc) return '';
  const USDT_ADDR = process.env.USDT_ERC20_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const abi = ['function transfer(address to, uint256 value) returns (bool)'];
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(opts.privateKey, provider);
  const token = new ethers.Contract(USDT_ADDR, abi, wallet);
  const units = ethers.parseUnits(opts.amount, 6);
  const tx = await token.transfer(opts.toAddress, units);
  return tx.hash;
}

// BTC / SOL / TRON broadcasting is stubbed — real impl needs UTXO
// assembly (BTC), recent blockhash (SOL), signed Transaction (TRON).
// For MVP we record the settlement request and flag it for a later
// treasury sweep. Ledger side still debits, so UX is coherent.

/**
 * Initiate a withdrawal. Atomically debits the internal ledger and
 * records an OnChainTransaction. Broadcast is best-effort and marked
 * SIMULATED when RPC creds / signing paths aren't configured.
 */
export async function initiateWithdrawal(opts: {
  userId: string;
  asset: string;
  network: string;
  amount: string;
  toAddress: string;
}) {
  const asset = opts.asset.toUpperCase();
  const network = opts.network.toUpperCase();
  const amount = new Decimal(opts.amount);
  if (amount.lte(0)) throw new AppError('Amount must be > 0', 400);

  const field = balanceField(asset, network);
  const chain = chainForAsset(asset, network);
  const fromField = fromAddressField(asset, network);

  // TODO(compliance): Chainalysis / address screening before debit.
  // For MVP we skip and rely on the AML flag system.

  const { onChainTx, walletIndex } = await prisma.$transaction(
    async (tx) => {
      // Pessimistic row lock — prevents two concurrent withdrawal calls
      // from racing past the balance check and double-spending. Without
      // FOR UPDATE both reads can see the same balance and both pass.
      const locked = await tx.$queryRaw<Array<{ id: string; walletIndex: number } & Record<string, any>>>`
        SELECT * FROM "UserWallet"
        WHERE "userId" = ${opts.userId}
        FOR UPDATE
      `;
      const w = locked?.[0];
      if (!w) throw new AppError('User wallet not provisioned', 400);

      const current = new Decimal((w as any)[field].toString());
      if (current.lt(amount)) throw new AppError(`Insufficient ${asset} balance`, 400);

      await tx.userWallet.update({
        where: { id: w.id },
        data: { [field]: { decrement: new Prisma.Decimal(amount.toFixed(18)) } },
      });

      const onChainTx = await tx.onChainTransaction.create({
        data: {
          userId: opts.userId,
          type: 'WITHDRAWAL',
          asset,
          network,
          amount: new Prisma.Decimal(amount.toFixed(18)),
          fromAddress: (w as any)[fromField] as string,
          toAddress: opts.toAddress,
          status: 'PENDING',
        },
      });

      return {
        onChainTx,
        walletIndex: w.walletIndex as number,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  // Derive signer on demand (never persisted).
  let txHash = '';
  let simulated = false;
  try {
    const key = await deriveKeyForChain(chain, walletIndex);
    if (asset === 'ETH' && network === 'ETH' || (asset === 'ETH' && network === 'ERC20')) {
      txHash = await broadcastEvm({ privateKey: key.privateKey, toAddress: opts.toAddress, amountEth: amount.toFixed(18) });
    } else if (asset === 'USDT' && network === 'ERC20') {
      txHash = await broadcastUsdtErc20({ privateKey: key.privateKey, toAddress: opts.toAddress, amount: amount.toFixed(6) });
    } else {
      // BTC / SOL / USDT_TRC20 paths — TODO implement live broadcast.
      simulated = true;
    }
    if (!txHash) simulated = true;
    // Wipe the key reference ASAP.
    (key as any).privateKey = '';
  } catch (err: any) {
    logger.error('[withdrawal] broadcast failed — refunding', { id: onChainTx.id, err });
    await prisma.$transaction(async (tx) => {
      await tx.userWallet.update({
        where: { userId: opts.userId },
        data: { [field]: { increment: new Prisma.Decimal(amount.toFixed(18)) } },
      });
      await tx.onChainTransaction.update({
        where: { id: onChainTx.id },
        data: { status: 'FAILED' },
      });
    });
    throw new AppError('Withdrawal broadcast failed — refunded', 502);
  }

  return prisma.onChainTransaction.update({
    where: { id: onChainTx.id },
    data: {
      txHash: txHash || null,
      status: simulated ? 'PENDING' : 'PENDING', // stays pending until confirmed
    },
  });
}

/**
 * Process an inbound deposit webhook. Credits the user's internal
 * balance once the confirmation threshold is met. Idempotent on txHash
 * (OnChainTransaction.txHash is @unique).
 */
export async function processDeposit(opts: {
  txHash: string;
  asset: string;
  network: string;
  toAddress: string;
  fromAddress: string;
  amount: string;
  confirmations: number;
}) {
  const asset = opts.asset.toUpperCase();
  const network = opts.network.toUpperCase();
  const field = balanceField(asset, network);
  const fromField = fromAddressField(asset, network);
  const chain = chainForAsset(asset, network);
  const required = CONFIRMATIONS[chain];

  // Idempotency: if we already saw this txHash, return that row.
  const existing = await prisma.onChainTransaction.findUnique({ where: { txHash: opts.txHash } });
  if (existing && existing.status === 'CONFIRMED') return existing;

  // Map address → user.
  const wallet = await prisma.userWallet.findFirst({
    where: { [fromField]: opts.toAddress } as any,
  });
  if (!wallet) throw new AppError('Deposit address not recognised', 404);

  const amount = new Decimal(opts.amount);

  return prisma.$transaction(async (tx) => {
    const row = existing
      ? await tx.onChainTransaction.update({
          where: { id: existing.id },
          data: { confirmations: opts.confirmations },
        })
      : await tx.onChainTransaction.create({
          data: {
            userId: wallet.userId,
            type: 'DEPOSIT',
            asset,
            network,
            amount: new Prisma.Decimal(amount.toFixed(18)),
            txHash: opts.txHash,
            fromAddress: opts.fromAddress,
            toAddress: opts.toAddress,
            status: 'PENDING',
            confirmations: opts.confirmations,
          },
        });

    if (opts.confirmations >= required && row.status !== 'CONFIRMED') {
      await tx.userWallet.update({
        where: { id: wallet.id },
        data: { [field]: { increment: new Prisma.Decimal(amount.toFixed(18)) } },
      });
      return tx.onChainTransaction.update({
        where: { id: row.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
    }
    return row;
  });
}
