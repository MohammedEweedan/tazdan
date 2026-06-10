/**
 * On-chain deposit verification.
 *
 * Webhook payloads (Alchemy, Trongrid, internal X-Webhook-Secret) are
 * treated as NOTIFICATIONS ONLY. Before any balance is credited we
 * independently fetch the transaction from the chain and derive:
 *
 *   - that the tx exists and succeeded,
 *   - the amount actually received at the custody address,
 *   - the CURRENT confirmation count.
 *
 * Without this, anyone who can reach a webhook endpoint (or any
 * misconfigured/compromised provider) can mint internal balances by
 * posting a forged payload — the single worst failure mode a custodial
 * platform has.
 *
 * FAIL-CLOSED: if the chain cannot be queried (RPC missing, provider
 * down) we throw and the deposit stays uncredited. Providers retry
 * webhooks, and the tx can always be re-submitted; conjured balances
 * cannot be un-spent.
 *
 * Dev/test escape hatch: ALLOW_UNVERIFIED_DEPOSITS=1 (refused in
 * production) or NODE_ENV=test skips chain calls so simulators and
 * unit tests keep working.
 */
import Decimal from 'decimal.js';
import axios from 'axios';
import { ethers } from 'ethers';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export interface VerifiedDeposit {
  /** Amount received at the custody address, derived from the chain. */
  amount: Decimal;
  /** Confirmation count as of now, derived from the chain. */
  confirmations: number;
}

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function evmRpcUrl(): string | null {
  return (
    process.env.ALCHEMY_RPC_URL ??
    (process.env.ALCHEMY_API_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : null)
  );
}

export function unverifiedDepositsAllowed(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_UNVERIFIED_DEPOSITS === '1'
  );
}

/** 503 = transient; webhook senders retry, nothing is credited. */
function unavailable(msg: string): never {
  throw new AppError(`Deposit verification unavailable: ${msg}`, 503);
}

/** 400 = the claimed tx does not match the chain. Never credit. */
function mismatch(msg: string): never {
  throw new AppError(`Deposit verification failed: ${msg}`, 400);
}

// ── ETH native ────────────────────────────────────────────────────────

async function verifyEthNative(txHash: string, toAddress: string): Promise<VerifiedDeposit> {
  const rpc = evmRpcUrl();
  if (!rpc) unavailable('no EVM RPC configured (ALCHEMY_RPC_URL / ALCHEMY_API_KEY)');
  const provider = new ethers.JsonRpcProvider(rpc);

  const [tx, receipt, current] = await Promise.all([
    provider.getTransaction(txHash),
    provider.getTransactionReceipt(txHash),
    provider.getBlockNumber(),
  ]);
  if (!tx) mismatch(`ETH tx ${txHash} not found`);
  if (!receipt || receipt.blockNumber == null) {
    return { amount: new Decimal(ethers.formatEther(tx.value)), confirmations: 0 };
  }
  if (receipt.status !== 1) mismatch(`ETH tx ${txHash} reverted`);
  if ((tx.to ?? '').toLowerCase() !== toAddress.toLowerCase()) {
    mismatch(`ETH tx ${txHash} recipient ${tx.to} != custody address ${toAddress}`);
  }
  return {
    amount: new Decimal(ethers.formatEther(tx.value)),
    confirmations: current - receipt.blockNumber + 1,
  };
}

// ── USDT ERC-20 ───────────────────────────────────────────────────────

async function verifyUsdtErc20(txHash: string, toAddress: string): Promise<VerifiedDeposit> {
  const rpc = evmRpcUrl();
  if (!rpc) unavailable('no EVM RPC configured (ALCHEMY_RPC_URL / ALCHEMY_API_KEY)');
  const provider = new ethers.JsonRpcProvider(rpc);
  const usdtAddr = (process.env.USDT_ERC20_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7').toLowerCase();

  const [receipt, current] = await Promise.all([
    provider.getTransactionReceipt(txHash),
    provider.getBlockNumber(),
  ]);
  if (!receipt) {
    const tx = await provider.getTransaction(txHash);
    if (!tx) mismatch(`USDT tx ${txHash} not found`);
    return { amount: new Decimal(0), confirmations: 0 }; // pending, not yet creditable
  }
  if (receipt.status !== 1) mismatch(`USDT tx ${txHash} reverted`);

  // Sum every USDT Transfer log paying the custody address. One tx may
  // contain several transfers (batch senders) — credit the total.
  const paddedTo = '0x' + toAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  let totalUnits = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdtAddr) continue;
    if (log.topics[0] !== ERC20_TRANSFER_TOPIC) continue;
    if ((log.topics[2] ?? '').toLowerCase() !== paddedTo) continue;
    totalUnits += BigInt(log.data);
  }
  if (totalUnits === 0n) {
    mismatch(`USDT tx ${txHash} contains no transfer to custody address ${toAddress}`);
  }
  return {
    amount: new Decimal(ethers.formatUnits(totalUnits, 6)),
    confirmations: current - receipt.blockNumber + 1,
  };
}

// ── BTC ───────────────────────────────────────────────────────────────

async function verifyBtc(txHash: string, toAddress: string): Promise<VerifiedDeposit> {
  const base = (process.env.MEMPOOL_API_URL || 'https://mempool.space/api').replace(/\/$/, '');
  let tx: any;
  let tipHeight: number;
  try {
    const [txRes, tipRes] = await Promise.all([
      axios.get(`${base}/tx/${txHash}`, { timeout: 8000 }),
      axios.get(`${base}/blocks/tip/height`, { timeout: 8000 }),
    ]);
    tx = txRes.data;
    tipHeight = Number(tipRes.data);
  } catch (e: any) {
    if (e?.response?.status === 404) mismatch(`BTC tx ${txHash} not found`);
    unavailable(`BTC explorer unreachable (${e?.message ?? 'error'})`);
  }

  const sats = (tx.vout ?? [])
    .filter((o: any) => o.scriptpubkey_address === toAddress)
    .reduce((sum: bigint, o: any) => sum + BigInt(o.value ?? 0), 0n);
  if (sats === 0n) {
    mismatch(`BTC tx ${txHash} pays nothing to custody address ${toAddress}`);
  }
  const confirmations = tx.status?.confirmed && tx.status.block_height
    ? tipHeight - Number(tx.status.block_height) + 1
    : 0;
  return { amount: new Decimal(sats.toString()).div(1e8), confirmations };
}

// ── SOL ───────────────────────────────────────────────────────────────

async function verifySol(txHash: string, toAddress: string): Promise<VerifiedDeposit> {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  let result: any;
  try {
    const res = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [txHash, {
        encoding: 'jsonParsed',
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0,
      }],
    }, { timeout: 8000 });
    result = res.data?.result;
  } catch (e: any) {
    unavailable(`Solana RPC unreachable (${e?.message ?? 'error'})`);
  }
  // Not finalized yet (or unknown) → zero confirmations, nothing credited.
  if (!result) return { amount: new Decimal(0), confirmations: 0 };
  if (result.meta?.err) mismatch(`SOL tx ${txHash} failed on-chain`);

  const keys: any[] = result.transaction?.message?.accountKeys ?? [];
  const idx = keys.findIndex((k: any) => (typeof k === 'string' ? k : k?.pubkey) === toAddress);
  if (idx < 0) mismatch(`SOL tx ${txHash} does not touch custody address ${toAddress}`);

  const pre = BigInt(result.meta?.preBalances?.[idx] ?? 0);
  const post = BigInt(result.meta?.postBalances?.[idx] ?? 0);
  if (post <= pre) mismatch(`SOL tx ${txHash} did not increase custody address balance`);

  // `finalized` commitment implies the cluster's supermajority has rooted
  // the block — report the platform threshold (32) as met.
  return { amount: new Decimal((post - pre).toString()).div(1e9), confirmations: 32 };
}

// ── USDT TRC-20 (Tron) ───────────────────────────────────────────────

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Decode a base58 Tron address to its 21-byte hex form (41 + 20-byte body).
 *  Exported for unit tests. */
export function tronBase58ToHex(address: string): string {
  let num = 0n;
  for (const ch of address) {
    const v = BASE58_ALPHABET.indexOf(ch);
    if (v < 0) mismatch(`invalid Tron address ${address}`);
    num = num * 58n + BigInt(v);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  // Leading '1' chars encode leading zero bytes.
  for (const ch of address) {
    if (ch !== '1') break;
    hex = '00' + hex;
  }
  // 21-byte payload + 4-byte checksum = 25 bytes = 50 hex chars.
  if (hex.length !== 50) mismatch(`malformed Tron address ${address}`);
  return hex.slice(0, 42).toLowerCase(); // drop checksum, keep 41+body
}

async function verifyUsdtTrc20(txHash: string, toAddress: string): Promise<VerifiedDeposit> {
  const base = (process.env.TRONGRID_API_URL || 'https://api.trongrid.io').replace(/\/$/, '');
  const headers: Record<string, string> = process.env.TRONGRID_API_KEY
    ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY }
    : {};
  // USDT TRC-20 contract, 20-byte hex (no 41 prefix) as it appears in logs.
  const usdtHex = (process.env.USDT_TRC20_ADDRESS_HEX || 'a614f803b6fd780986a42c78ec9c7f77e6ded13c').toLowerCase();

  let info: any;
  let nowBlock: number;
  try {
    const [infoRes, nowRes] = await Promise.all([
      axios.post(`${base}/wallet/gettransactioninfobyid`, { value: txHash }, { timeout: 8000, headers }),
      axios.post(`${base}/wallet/getnowblock`, {}, { timeout: 8000, headers }),
    ]);
    info = infoRes.data;
    nowBlock = Number(nowRes.data?.block_header?.raw_data?.number ?? 0);
  } catch (e: any) {
    unavailable(`Trongrid unreachable (${e?.message ?? 'error'})`);
  }
  if (!info || !info.id) mismatch(`TRON tx ${txHash} not found`);
  if (info.receipt?.result && info.receipt.result !== 'SUCCESS') {
    mismatch(`TRON tx ${txHash} failed (${info.receipt.result})`);
  }

  // Custody address as the 20-byte body (strip the 0x41 version byte) —
  // log topics left-pad it to 32 bytes.
  const toBodyHex = tronBase58ToHex(toAddress).slice(2);
  const paddedTo = toBodyHex.padStart(64, '0');

  let totalUnits = 0n;
  for (const log of info.log ?? []) {
    if ((log.address ?? '').toLowerCase() !== usdtHex) continue;
    const topics: string[] = log.topics ?? [];
    if ((topics[0] ?? '').toLowerCase() !== ERC20_TRANSFER_TOPIC.slice(2)) continue;
    if ((topics[2] ?? '').toLowerCase() !== paddedTo) continue;
    totalUnits += BigInt('0x' + (log.data || '0'));
  }
  if (totalUnits === 0n) {
    mismatch(`TRON tx ${txHash} contains no USDT transfer to custody address ${toAddress}`);
  }
  const confirmations = info.blockNumber && nowBlock
    ? Math.max(0, nowBlock - Number(info.blockNumber) + 1)
    : 0;
  return { amount: new Decimal(totalUnits.toString()).div(1e6), confirmations };
}

// ── Entry point ───────────────────────────────────────────────────────

/**
 * Verify a claimed deposit against the chain. Returns the chain-derived
 * amount and confirmation count; throws (fail-closed) on any mismatch or
 * when the chain cannot be queried.
 */
export async function verifyOnChainDeposit(opts: {
  txHash: string;
  asset: string;
  network: string;
  toAddress: string;
}): Promise<VerifiedDeposit> {
  const a = opts.asset.toUpperCase();
  const n = opts.network.toUpperCase();

  if (a === 'ETH') return verifyEthNative(opts.txHash, opts.toAddress);
  if (a === 'USDT' && n === 'ERC20') return verifyUsdtErc20(opts.txHash, opts.toAddress);
  if (a === 'USDT' && n === 'TRC20') return verifyUsdtTrc20(opts.txHash, opts.toAddress);
  if (a === 'BTC') return verifyBtc(opts.txHash, opts.toAddress);
  if (a === 'SOL') return verifySol(opts.txHash, opts.toAddress);

  unavailable(`no verifier for ${opts.asset}/${opts.network}`);
}

/** Log-once helper so dev environments are loudly aware of the bypass. */
let warnedUnverified = false;
export function warnUnverifiedOnce() {
  if (warnedUnverified) return;
  warnedUnverified = true;
  logger.warn(
    '[depositVerification] ALLOW_UNVERIFIED_DEPOSITS is active — webhook payloads are trusted without chain verification. NEVER enable in production.'
  );
}
