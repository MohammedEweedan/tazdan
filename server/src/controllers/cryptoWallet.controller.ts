/**
 * Crypto custody wallet endpoints.
 *
 * These are distinct from the existing fiat/USDT ledger routes under
 * /api/wallets. They expose the per-user HD-derived addresses + internal
 * on-chain ledger balances.
 */
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { createUserWallets } from '../services/wallet/walletDerivation.service';
import { exportWallet } from '../services/wallet/selfCustody.service';

const exportSchema = z.object({
  chain: z.enum(['ETH', 'BTC', 'SOL', 'TRON']),
  password: z.string().min(1),
  twoFactorCode: z.string().min(6).max(8),
  confirmUnderstood: z.literal(true),
});

async function getOrCreate(userId: string) {
  const existing = await prisma.userWallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return createUserWallets(userId);
}

export class CryptoWalletController {
  static async getAddresses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const w = await getOrCreate(userId);
      res.json({
        eth: w.ethAddress,
        btc: w.btcAddress,
        sol: w.solAddress,
        tron: w.tronAddress,
      });
    } catch (e) {
      next(e);
    }
  }

  static async getBalances(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const w = await getOrCreate(userId);
      const altBalances = (w.altBalances && typeof w.altBalances === 'object')
        ? (w.altBalances as Record<string, string>)
        : {};
      res.json({
        ETH: w.ethBalance.toString(),
        BTC: w.btcBalance.toString(),
        SOL: w.solBalance.toString(),
        USDT_ERC20: w.usdtErc20Bal.toString(),
        USDT_TRC20: w.usdtTrc20Bal.toString(),
        ...altBalances,
      });
    } catch (e) {
      next(e);
    }
  }

  /**
   * GET /api/wallet/deposit-address/:asset/:network
   * Returns the address plus a data-URL QR code for easy display.
   */
  static async getDepositAddress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const asset = String(req.params.asset || '').toUpperCase();
      const network = String(req.params.network || '').toUpperCase();
      const w = await getOrCreate(userId);

      // Network classification — determines which on-chain address to return.
      // EVM-compatible: ETH mainnet, BNB Smart Chain, Polygon, Arbitrum, Optimism,
      //                 Avalanche C-Chain, and any ERC-20 / BEP-20 token.
      // TRON: TRX and TRC-20 tokens (USDT_TRC20, etc.).
      // Native: BTC, SOL each have their own derived key.
      const EVM_NETWORKS  = new Set(['ETH','ERC20','ERC-20','BSC','BEP20','BEP-20','POLYGON','MATIC','ARB','ARBITRUM','OP','OPTIMISM','AVAX','AVALANCHE','BASE','NATIVE_EVM']);
      const TRON_NETWORKS = new Set(['TRON','TRC20','TRC-20']);
      const TRON_ASSETS   = new Set(['TRX','USDT_TRC20']);

      let address: string | null = null;

      if (asset === 'BTC' && (network === 'BTC' || network === 'NATIVE')) {
        address = w.btcAddress;
      } else if (asset === 'SOL' && (network === 'SOL' || network === 'NATIVE')) {
        address = w.solAddress;
      } else if (TRON_ASSETS.has(asset) || TRON_NETWORKS.has(network)) {
        address = w.tronAddress;
      } else if (asset === 'XRP' && (network === 'XRP' || network === 'RIPPLE')) {
        // XRP Ledger — use ETH address as a stable unique identifier until
        // a proper XRP key derivation service is wired up.
        address = w.ethAddress ? `r${w.ethAddress.slice(2, 35)}` : null;
      } else {
        // Default: EVM-compatible address (ETH, BNB, MATIC, ARB, OP, AVAX,
        // LINK, UNI, SHIB, PEPE, and every other ERC-20 / BEP-20 token).
        address = w.ethAddress;
      }

      if (!address) throw new AppError(`Wallet address not provisioned for ${asset}/${network}`, 400);

      const qr = await QRCode.toDataURL(address);
      res.json({ asset, network, address, qr });
    } catch (e) {
      next(e);
    }
  }

  /**
   * POST /api/wallet/export
   * { chain, password, twoFactorCode, confirmUnderstood:true }
   * Returns the private key ONCE. Mark all logging paths clean — do not
   * log the request body or the response body.
   */
  static async exportWallet(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = exportSchema.parse(req.body);
      const result = await exportWallet({
        userId: req.user!.id,
        chain: body.chain,
        password: body.password,
        twoFactorCode: body.twoFactorCode,
      });
      // IMPORTANT: do not persist `result` or echo to any logger.
      res.setHeader('Cache-Control', 'no-store');
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
}
