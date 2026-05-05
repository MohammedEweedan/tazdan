/**
 * Self-custody export.
 *
 * Flow (per spec):
 *   1. Verify password + TOTP 2FA.
 *   2. Require KYC tier 2+.
 *   3. Derive the requested chain's private key on demand.
 *   4. Mark UserWallet.selfCustodyExported = true and zero the custodial
 *      balance for that chain — the user now owns it.
 *   5. Return { privateKey, address, importInstructions } ONCE. Never
 *      stored, never logged.
 *
 * MVP scope: per-chain private key export only. Full 24-word seed export
 * is intentionally not implemented (single seed powers many users).
 */
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { deriveKeyForChain } from './walletDerivation.service';

type Chain = 'ETH' | 'BTC' | 'SOL' | 'TRON';

function balanceFieldForChain(chain: Chain):
  'ethBalance' | 'btcBalance' | 'solBalance' | 'tronAddress' | null {
  // Note: TRON currently has no native-balance column (only tronAddress).
  // For USDT-TRC20 we keep the custodial balance even after key export
  // because the same private key also controls TRX/TRC20 — behaviour
  // documented in the import instructions.
  if (chain === 'ETH') return 'ethBalance';
  if (chain === 'BTC') return 'btcBalance';
  if (chain === 'SOL') return 'solBalance';
  return null;
}

function addressFieldForChain(chain: Chain):
  'ethAddress' | 'btcAddress' | 'solAddress' | 'tronAddress' {
  if (chain === 'ETH') return 'ethAddress';
  if (chain === 'BTC') return 'btcAddress';
  if (chain === 'SOL') return 'solAddress';
  return 'tronAddress';
}

function importInstructions(chain: Chain): string {
  switch (chain) {
    case 'ETH':
      return 'MetaMask → Account menu → Import Account → paste the private key (with or without 0x prefix). Compatible with any EVM wallet (Trust Wallet, Rainbow, Coinbase Wallet).';
    case 'BTC':
      return 'Electrum → File → New/Restore → "Import Bitcoin addresses or private keys" → paste the WIF / hex private key. Native SegWit (bech32, bc1…).';
    case 'SOL':
      return 'Phantom → Settings → Add / Connect Wallet → Import Private Key → paste the 64-byte hex (or convert to base58 if your wallet requires it).';
    case 'TRON':
      return 'TronLink → Settings → Import wallet → "Private Key" → paste the hex. Same key also controls USDT-TRC20 on this address.';
  }
}

export interface ExportRequest {
  userId: string;
  chain: Chain;
  password: string;
  twoFactorCode: string;
}

export interface ExportResult {
  chain: Chain;
  address: string;
  privateKey: string;
  importInstructions: string;
  exportedAt: Date;
}

/**
 * Verify credentials and export a per-chain private key.
 * Throws AppError on any validation failure — never leaks the key in
 * that case.
 */
export async function exportWallet(req: ExportRequest): Promise<ExportResult> {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new AppError('User not found', 404);

  // 1. Password.
  const ok = await bcrypt.compare(req.password, user.passwordHash);
  if (!ok) throw new AppError('Invalid password', 401);

  // 2. 2FA (mandatory for export, even if user hasn't enabled it elsewhere).
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError('Enable 2FA before exporting a wallet', 403);
  }
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: req.twoFactorCode,
    window: 2,
  });
  if (!verified) throw new AppError('Invalid 2FA code', 401);

  // 3. KYC tier 2+.
  if (user.kycTier !== 'TIER_2' && user.kycTier !== 'TIER_3') {
    throw new AppError('KYC Tier 2 required for self-custody export', 403);
  }

  // 4. Load the wallet row + derive.
  const wallet = await prisma.userWallet.findUnique({ where: { userId: req.userId } });
  if (!wallet) throw new AppError('Custody wallet not provisioned', 400);

  const derived = await deriveKeyForChain(req.chain, wallet.walletIndex);
  const addrField = addressFieldForChain(req.chain);
  const balField = balanceFieldForChain(req.chain);
  const exportedAt = new Date();

  // 5. Mark exported + zero the custodial balance for that chain.
  await prisma.$transaction(async (tx) => {
    await tx.userWallet.update({
      where: { id: wallet.id },
      data: {
        selfCustodyExported: true,
        exportedAt,
        ...(balField ? { [balField]: new Prisma.Decimal(0) } : {}),
      },
    });
  });

  const result: ExportResult = {
    chain: req.chain,
    address: (wallet as any)[addrField] as string,
    privateKey: derived.privateKey,
    importInstructions: importInstructions(req.chain),
    exportedAt,
  };

  // Post-return: wipe local reference (no further use).
  (derived as any).privateKey = '';

  return result;
}
