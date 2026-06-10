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
import { sendDepositConfirmed } from '../email';
import { pushCopy, pushTxEvent } from '../push.service';
import { postLedger } from '../ledger/ledger.service';
import { deriveKeyForChain } from './walletDerivation.service';
import {
  verifyOnChainDeposit,
  unverifiedDepositsAllowed,
  warnUnverifiedOnce,
} from './depositVerification.service';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

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

// ── Daily withdrawal caps (treasury protection) ──────────────────────
// A compromised account (or a compromised signing path) is rate-limited in
// VALUE, not just requests: per-user and platform-wide caps per asset per
// UTC day. Admin-tunable via PlatformSettings keys
//   onchain_user_daily_cap_<asset> / onchain_platform_daily_cap_<asset>
// with conservative code defaults. The platform cap is the blast-radius
// bound: even with many compromised accounts, at most this much of an
// asset can leave custody per day.
const DEFAULT_USER_DAILY_CAP: Record<string, string> = {
  BTC: '0.25', ETH: '3', SOL: '150', USDT: '10000',
};
const DEFAULT_PLATFORM_DAILY_CAP: Record<string, string> = {
  BTC: '1', ETH: '15', SOL: '750', USDT: '50000',
};

async function dailyCapFor(tx: Prisma.TransactionClient, kind: 'user' | 'platform', asset: string): Promise<Decimal> {
  const key = `onchain_${kind}_daily_cap_${asset.toLowerCase()}`;
  const row = await tx.platformSettings.findUnique({ where: { key } }).catch(() => null);
  const fallback = (kind === 'user' ? DEFAULT_USER_DAILY_CAP : DEFAULT_PLATFORM_DAILY_CAP)[asset] ?? '0';
  const raw = row?.value ?? fallback;
  const v = new Decimal(raw || '0');
  return v.isFinite() && v.gt(0) ? v : new Decimal(fallback || '0');
}

/** Sum of today's (UTC) non-failed on-chain withdrawals for the asset. */
async function withdrawnTodayUtc(
  tx: Prisma.TransactionClient,
  asset: string,
  userId?: string,
): Promise<Decimal> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const agg = await tx.onChainTransaction.aggregate({
    where: {
      type: 'WITHDRAWAL',
      asset,
      createdAt: { gte: dayStart },
      status: { not: 'FAILED' },
      ...(userId ? { userId } : {}),
    },
    _sum: { amount: true },
  });
  return new Decimal(agg._sum.amount?.toString() ?? '0');
}

async function enforceDailyCaps(
  tx: Prisma.TransactionClient,
  userId: string,
  asset: string,
  amount: Decimal,
): Promise<void> {
  const [userCap, platformCap, userToday, platformToday] = await Promise.all([
    dailyCapFor(tx, 'user', asset),
    dailyCapFor(tx, 'platform', asset),
    withdrawnTodayUtc(tx, asset, userId),
    withdrawnTodayUtc(tx, asset),
  ]);
  if (userCap.gt(0) && userToday.plus(amount).gt(userCap)) {
    throw new AppError(
      `Daily ${asset} withdrawal limit reached (${userCap.toString()} ${asset}/day). Try again tomorrow or contact support.`,
      429,
    );
  }
  if (platformCap.gt(0) && platformToday.plus(amount).gt(platformCap)) {
    logger.error('[treasury] PLATFORM daily withdrawal cap hit', {
      asset, platformToday: platformToday.toString(), attempted: amount.toString(),
    });
    throw new AppError(
      `${asset} withdrawals are temporarily paused. Please try again later.`,
      503,
    );
  }
}

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
 * Asset/network pairs we can actually sign + broadcast today.
 * BTC (UTXO assembly), SOL and TRON (TRC-20) signing are not implemented —
 * withdrawals for those MUST be rejected up front rather than debited and
 * left in a permanent PENDING that never reaches the chain.
 */
function supportsLiveBroadcast(asset: string, network: string): boolean {
  const a = asset.toUpperCase();
  const n = network.toUpperCase();
  if (a === 'ETH' && (n === 'ETH' || n === 'ERC20')) return true;
  if (a === 'USDT' && n === 'ERC20') return true;
  if (a === 'BTC') return true;   // P2WPKH via mempool.space (broadcastBtc)
  if (a === 'SOL') return true;   // native transfer via RPC (broadcastSol)
  // USDT/TRC20 stays gated until the TRX fee-delegation treasury exists.
  return false;
}

/**
 * Simulated broadcasts (debit the ledger, skip the chain) are a dev/test
 * convenience only. In production a simulated withdrawal is indistinguishable
 * from theft — the user's balance drops and nothing ever arrives.
 */
function simulatedBroadcastAllowed(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_SIMULATED_ONCHAIN_BROADCAST === '1'
  );
}

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

// ── BTC (P2WPKH) ─────────────────────────────────────────────────────
// UTXO assembly + fee estimation via the mempool.space REST API, PSBT
// signing with the user's derived key, broadcast via POST /api/tx.

const BTC_DUST_SATS = 546n;

async function broadcastBtc(opts: {
  privateKey: string;   // 32-byte hex (see deriveBtcWallet)
  fromAddress: string;  // bc1… P2WPKH
  toAddress: string;
  amountBtc: string;
}): Promise<string> {
  const base = (process.env.MEMPOOL_API_URL || 'https://mempool.space/api').replace(/\/$/, '');
  const network = bitcoin.networks.bitcoin;

  const [utxoRes, feeRes] = await Promise.all([
    axios.get(`${base}/address/${opts.fromAddress}/utxo`, { timeout: 10_000 }),
    axios.get(`${base}/v1/fees/recommended`, { timeout: 10_000 }),
  ]);
  const utxos: Array<{ txid: string; vout: number; value: number; status?: { confirmed?: boolean } }> =
    (utxoRes.data ?? []).filter((u: any) => u.status?.confirmed !== false);
  if (!utxos.length) throw new Error('No confirmed UTXOs on custody address');

  const satPerVb = BigInt(Math.max(1, Number(feeRes.data?.halfHourFee ?? 10)));
  const target = BigInt(new Decimal(opts.amountBtc).mul(1e8).toFixed(0));
  if (target <= BTC_DUST_SATS) throw new Error('BTC amount below dust threshold');

  const keyPair = ECPair.fromPrivateKey(Buffer.from(opts.privateKey, 'hex'), { network });
  const payment = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network });
  if (payment.address !== opts.fromAddress) {
    throw new Error('Derived key does not match custody address'); // never sign with a mismatched key
  }

  // Accumulate inputs largest-first until amount + fee is covered.
  // P2WPKH vbytes ≈ 10.5 overhead + 68 per input + 31 per output.
  utxos.sort((a, b) => b.value - a.value);
  const selected: typeof utxos = [];
  let inSats = 0n;
  let fee = 0n;
  for (const u of utxos) {
    selected.push(u);
    inSats += BigInt(u.value);
    fee = (11n + 68n * BigInt(selected.length) + 31n * 2n) * satPerVb;
    if (inSats >= target + fee) break;
  }
  if (inSats < target + fee) throw new Error('Insufficient confirmed UTXO value for amount + network fee');

  const psbt = new bitcoin.Psbt({ network });
  for (const u of selected) {
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      witnessUtxo: { script: payment.output!, value: BigInt(u.value) },
    });
  }
  psbt.addOutput({ address: opts.toAddress, value: target });
  const change = inSats - target - fee;
  if (change > BTC_DUST_SATS) {
    psbt.addOutput({ address: opts.fromAddress, value: change });
  } // else: sub-dust change is burned into the fee

  const signer = {
    publicKey: Buffer.from(keyPair.publicKey),
    sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash)),
  };
  for (let i = 0; i < selected.length; i++) psbt.signInput(i, signer);
  psbt.finalizeAllInputs();
  const rawHex = psbt.extractTransaction().toHex();

  const broadcast = await axios.post(`${base}/tx`, rawHex, {
    timeout: 15_000,
    headers: { 'Content-Type': 'text/plain' },
  });
  const txid = String(broadcast.data ?? '').trim();
  if (!/^[0-9a-f]{64}$/i.test(txid)) throw new Error(`BTC broadcast returned unexpected response: ${txid.slice(0, 80)}`);
  return txid;
}

// ── SOL (native transfer) ────────────────────────────────────────────
async function broadcastSol(opts: {
  privateKey: string;   // 64-byte secretKey hex (see deriveSolWallet)
  toAddress: string;
  amountSol: string;
}): Promise<string> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  const keypair = SolKeypair.fromSecretKey(Buffer.from(opts.privateKey, 'hex'));
  const lamports = BigInt(new Decimal(opts.amountSol).mul(LAMPORTS_PER_SOL).toFixed(0));
  if (lamports <= 0n) throw new Error('SOL amount too small');

  const tx = new SolTransaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: new PublicKey(opts.toAddress),
      lamports: Number(lamports),
    }),
  );
  return sendAndConfirmTransaction(connection, tx, [keypair], { commitment: 'confirmed' });
}

// Operator-CLI sweep wrappers (scripts/treasury-sweep.ts) — same signing
// paths as withdrawals, exported so cold-storage sweeps don't duplicate
// broadcast logic.
export function sweepBtc(privateKey: string, fromAddress: string, toAddress: string, amountBtc: string) {
  return broadcastBtc({ privateKey, fromAddress, toAddress, amountBtc });
}
export function sweepSol(privateKey: string, toAddress: string, amountSol: string) {
  return broadcastSol({ privateKey, toAddress, amountSol });
}

// TRON (TRC-20 USDT) broadcasting is intentionally NOT implemented yet:
// TRC-20 transfers burn TRX for energy/bandwidth, and user deposit
// addresses hold no TRX — every transfer would revert until a fee-
// delegation / TRX top-up treasury exists. See
// docs/runbooks/custody-cold-storage.md for the rollout plan. Until then
// TRON withdrawals fail closed BEFORE any debit (supportsLiveBroadcast).

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

  // Fail BEFORE the debit for assets we cannot broadcast. Anything else
  // either errors-and-refunds (wasted ledger churn) or, with the simulated
  // flag, silently strands user funds.
  if (!supportsLiveBroadcast(asset, network) && !simulatedBroadcastAllowed()) {
    throw new AppError(
      `${asset}/${network} withdrawals are temporarily unavailable. Please contact support.`,
      503,
    );
  }

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

      // Value-based rate limiting: per-user + platform-wide daily caps.
      // Inside the SERIALIZABLE tx so two concurrent withdrawals can't both
      // squeeze under the cap.
      await enforceDailyCaps(tx, opts.userId, asset, amount);

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

      await postLedger(tx as any, {
        refType: 'onchain_withdrawal',
        refId: onChainTx.id,
        memo: `On-chain withdrawal ${asset} ${network}`,
        legs: [
          { type: 'USER', userId: opts.userId, currency: asset as any, amount: amount.mul(-1).toFixed(18) },
          { type: 'SYSTEM_CHAIN', currency: asset as any, amount: amount.toFixed(18) },
        ],
      }, { allowNegativeUser: true });

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
    } else if (asset === 'BTC') {
      txHash = await broadcastBtc({
        privateKey: key.privateKey,
        fromAddress: onChainTx.fromAddress,
        toAddress: opts.toAddress,
        amountBtc: amount.toFixed(8),
      });
    } else if (asset === 'SOL') {
      txHash = await broadcastSol({
        privateKey: key.privateKey,
        toAddress: opts.toAddress,
        amountSol: amount.toFixed(9),
      });
    } else {
      if (simulatedBroadcastAllowed()) {
        simulated = true;
      } else {
        throw new Error(`Live broadcast not implemented for ${asset}/${network}`);
      }
    }
    if (!txHash && simulatedBroadcastAllowed()) simulated = true;
    if (!txHash && !simulated) throw new Error(`Broadcast returned no tx hash for ${asset}/${network}`);
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
      await postLedger(tx as any, {
        refType: 'onchain_withdrawal_refund',
        refId: onChainTx.id,
        memo: `Refund failed on-chain withdrawal ${asset} ${network}`,
        legs: [
          { type: 'SYSTEM_CHAIN', currency: asset as any, amount: amount.mul(-1).toFixed(18) },
          { type: 'USER', userId: opts.userId, currency: asset as any, amount: amount.toFixed(18) },
        ],
      }, { allowNegativeUser: true });
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

  // The webhook payload is a NOTIFICATION, not a source of truth. Amount
  // and confirmation count are re-derived from the chain before anything
  // is credited — a forged or replayed payload can at worst make us look
  // up a tx that doesn't pay us, which fails closed.
  let amount = new Decimal(opts.amount);
  let confirmations = opts.confirmations;
  if (unverifiedDepositsAllowed()) {
    warnUnverifiedOnce();
  } else {
    const verified = await verifyOnChainDeposit({
      txHash: opts.txHash,
      asset,
      network,
      toAddress: opts.toAddress,
    });
    if (!verified.amount.eq(amount)) {
      logger.warn('[deposit] webhook amount differs from chain — using chain value', {
        txHash: opts.txHash,
        claimed: amount.toString(),
        chain: verified.amount.toString(),
      });
    }
    amount = verified.amount;
    confirmations = verified.confirmations;
    if (amount.lte(0)) throw new AppError('Deposit has zero on-chain value', 400);
  }

  return prisma.$transaction(async (tx) => {
    const row = existing
      ? await tx.onChainTransaction.update({
          where: { id: existing.id },
          // Re-assert the chain-derived amount: the row may have been
          // created from an earlier (unverified or differing) payload.
          data: { confirmations, amount: new Prisma.Decimal(amount.toFixed(18)) },
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
            confirmations,
          },
        });

    if (confirmations >= required && row.status !== 'CONFIRMED') {
      await tx.userWallet.update({
        where: { id: wallet.id },
        data: { [field]: { increment: new Prisma.Decimal(amount.toFixed(18)) } },
      });
      await postLedger(tx as any, {
        refType: 'onchain_deposit',
        refId: row.id,
        memo: `Confirmed on-chain deposit ${asset} ${network}`,
        legs: [
          { type: 'SYSTEM_CHAIN', currency: asset as any, amount: amount.mul(-1).toFixed(18) },
          { type: 'USER', userId: wallet.userId, currency: asset as any, amount: amount.toFixed(18) },
        ],
      }, { allowNegativeUser: true });
      const confirmed = await tx.onChainTransaction.update({
        where: { id: row.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });

      // Fire-and-forget email + push — deposit just landed.
      (async () => {
        try {
          const u = await prisma.user.findUnique({
            where: { id: wallet.userId },
            select: { email: true, firstName: true, notificationPrefs: true as any },
          });
          if (!u) return;
          const prefs = (u as any).notificationPrefs ?? {};
          const amt = amount.toFixed(8).replace(/\.?0+$/, '');
          if (prefs?.email?.deposits !== false) {
            await sendDepositConfirmed({
              to: u.email, firstName: u.firstName || 'there',
              asset, amount: amt, txHash: opts.txHash,
            });
          }
          if (prefs?.push?.deposits !== false) {
            await pushTxEvent(wallet.userId, pushCopy.depositOn(amt, asset), opts.txHash);
          }
        } catch (err) {
          logger.warn('[onchainSettlement.processDeposit] notify failed', { userId: wallet.userId, txHash: opts.txHash, err });
        }
      })();

      return confirmed;
    }
    return row;
  });
}
