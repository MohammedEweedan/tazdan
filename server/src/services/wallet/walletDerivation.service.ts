/**
 * HD wallet derivation for ETH, BTC, SOL, TRON from a single BIP-39 master
 * seed (see masterSeed.service.ts).
 *
 * Derivation paths (BIP-44):
 *   ETH / EVM: m/44'/60'/0'/0/{index}
 *   BTC:       m/44'/0'/0'/0/{index}   (P2WPKH native segwit)
 *   SOL:       m/44'/501'/0'/{index}'  (ed25519)
 *   TRON:      m/44'/195'/0'/0/{index}
 *
 * Each user gets a monotonically increasing `walletIndex`. The UserWallet
 * row stores only addresses — private keys are derived on demand at sign
 * time and never persisted.
 */
import { HDNodeWallet, Mnemonic } from 'ethers';
import BIP32Factory from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { Keypair as SolKeypair } from '@solana/web3.js';
import { derivePath as deriveSolPath } from 'ed25519-hd-key';
import { prisma } from '../../utils/prisma';
import { getMasterMnemonic, getMasterSeedBuffer } from './masterSeed.service';

const bip32 = BIP32Factory(ecc);

export interface DerivedWallet {
  address: string;
  /** Hex-encoded private key, without 0x prefix unless noted. For EVM it
   *  includes the standard 0x prefix via ethers. */
  privateKey: string;
}

// ── ETH / EVM ────────────────────────────────────────────────────────
export async function deriveEthWallet(userIndex: number): Promise<DerivedWallet> {
  const mnemonic = await getMasterMnemonic();
  const path = `m/44'/60'/0'/0/${userIndex}`;
  const wallet = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic), path);
  return { address: wallet.address, privateKey: wallet.privateKey };
}

// ── BTC (P2WPKH native segwit, bc1...) ───────────────────────────────
export async function deriveBtcWallet(userIndex: number): Promise<DerivedWallet> {
  const seed = await getMasterSeedBuffer();
  const root = bip32.fromSeed(seed);
  const child = root.derivePath(`m/44'/0'/0'/0/${userIndex}`);
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: bitcoin.networks.bitcoin,
  });
  if (!address) throw new Error('Failed to derive BTC address');
  if (!child.privateKey) throw new Error('Failed to derive BTC private key');
  return {
    address,
    privateKey: Buffer.from(child.privateKey).toString('hex'),
  };
}

// ── SOL (ed25519) ────────────────────────────────────────────────────
export async function deriveSolWallet(userIndex: number): Promise<DerivedWallet> {
  const seed = await getMasterSeedBuffer();
  const path = `m/44'/501'/0'/${userIndex}'`;
  const { key } = deriveSolPath(path, seed.toString('hex'));
  const keypair = SolKeypair.fromSeed(key);
  return {
    address: keypair.publicKey.toBase58(),
    // Solana convention: 64-byte secret key (seed || pubkey). Export as hex.
    privateKey: Buffer.from(keypair.secretKey).toString('hex'),
  };
}

// ── TRON ─────────────────────────────────────────────────────────────
export async function deriveTronWallet(userIndex: number): Promise<DerivedWallet> {
  const seed = await getMasterSeedBuffer();
  const root = bip32.fromSeed(seed);
  const child = root.derivePath(`m/44'/195'/0'/0/${userIndex}`);
  if (!child.privateKey) throw new Error('Failed to derive TRON private key');
  const pkHex = Buffer.from(child.privateKey).toString('hex');

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tronweb = require('tronweb');
    // tronweb exports { TronWeb, ... } — the class (with static address helpers)
    // is under the .TronWeb key, not the module root.
    const TronWeb = tronweb.TronWeb ?? tronweb.default ?? tronweb;
    const address = TronWeb.address.fromPrivateKey(pkHex);
    if (!address) throw new Error('Failed to derive TRON address');
    return { address, privateKey: pkHex };
  } catch (err: any) {
    console.error('[deriveTronWallet] Failed to derive TRON address:', err.message);
    // Return a placeholder address if TRON derivation fails
    return { address: `TRON-PENDING-${pkHex.slice(0, 8)}`, privateKey: pkHex };
  }
}

/**
 * Derives all 4 chain addresses for a user and persists them to
 * UserWallet. Idempotent — returns the existing row on re-call. The
 * `walletIndex` is assigned by Postgres via autoincrement().
 */
export async function createUserWallets(userId: string) {
  const existing = await prisma.userWallet.findUnique({ where: { userId } });
  if (existing) return existing;

  // Step 1 — reserve a row to claim a walletIndex from Postgres.
  // Placeholder addresses satisfy the @unique constraints temporarily.
  // This is a plain fast write, no interactive transaction.
  const placeholder = `pending-${userId}`;
  const row = await prisma.userWallet.create({
    data: {
      userId,
      ethAddress:  `${placeholder}-eth`,
      btcAddress:  `${placeholder}-btc`,
      solAddress:  `${placeholder}-sol`,
      tronAddress: `${placeholder}-tron`,
    },
  });

  // Step 2 — derive all addresses OUTSIDE any transaction. These are
  // CPU-heavy (BIP-32 + crypto) and can take 200–500 ms each under load,
  // which would exceed Prisma's 5 s interactive transaction timeout.
  const index = row.walletIndex;
  const [eth, btc, sol, tron] = await Promise.all([
    deriveEthWallet(index),
    deriveBtcWallet(index),
    deriveSolWallet(index),
    deriveTronWallet(index),
  ]);

  // Step 3 — single fast update to write the real addresses.
  return prisma.userWallet.update({
    where: { id: row.id },
    data: {
      ethAddress:  eth.address,
      btcAddress:  btc.address,
      solAddress:  sol.address,
      tronAddress: tron.address,
    },
  });
}

/**
 * Derive the private key for a single chain on demand. Used only by the
 * signing paths (withdrawal, self-custody export). The returned string
 * must be wiped by the caller as soon as it has been consumed.
 */
export async function deriveKeyForChain(
  chain: 'ETH' | 'BTC' | 'SOL' | 'TRON',
  walletIndex: number,
): Promise<DerivedWallet> {
  switch (chain) {
    case 'ETH':
      return deriveEthWallet(walletIndex);
    case 'BTC':
      return deriveBtcWallet(walletIndex);
    case 'SOL':
      return deriveSolWallet(walletIndex);
    case 'TRON':
      return deriveTronWallet(walletIndex);
  }
}
