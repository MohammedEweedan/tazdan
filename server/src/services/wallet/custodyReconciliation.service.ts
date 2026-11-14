import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { custodyMode, remoteWithdrawalStatus } from './custodyProvider.service';
import { postLedger } from '../ledger/ledger.service';

function balanceField(asset: string, network: string) {
  if (asset === 'ETH') return 'ethBalance';
  if (asset === 'BTC') return 'btcBalance';
  if (asset === 'SOL') return 'solBalance';
  if (asset === 'USDT') return network === 'TRC20' ? 'usdtTrc20Bal' : 'usdtErc20Bal';
  throw new Error('Unsupported custody asset');
}

export async function reconcileCustodyWithdrawals() {
  if (custodyMode() !== 'remote') return;
  const pending = await prisma.onChainTransaction.findMany({
    where: { type: 'WITHDRAWAL', status: { in: ['BROADCAST_UNKNOWN', 'PENDING'] } },
    orderBy: { createdAt: 'asc' }, take: 50,
  });
  for (const operation of pending) {
    try {
      const result = await remoteWithdrawalStatus(operation.id);
      if (result.status === 'UNKNOWN') continue;
      if (operation.txHash && result.txHash !== operation.txHash) throw new Error('Custody transaction reference changed');
      if (result.status === 'REJECTED') {
        if (!result.definitiveNoBroadcast || result.txHash) continue;
        await prisma.$transaction(async tx => {
          const moved = await tx.onChainTransaction.updateMany({
            where: { id: operation.id, status: { in: ['BROADCAST_UNKNOWN', 'PENDING'] }, txHash: null },
            data: { status: 'FAILED' },
          });
          if (moved.count !== 1) return;
          await tx.userWallet.update({ where: { userId: operation.userId }, data: { [balanceField(operation.asset, operation.network)]: { increment: operation.amount } } });
          await postLedger(tx, { refType: 'onchain_withdrawal_refund', refId: operation.id, memo: 'Custody provider confirmed no broadcast', legs: [
            { type: 'SYSTEM_CHAIN', currency: operation.asset as any, amount: operation.amount.negated().toString() },
            { type: 'USER', userId: operation.userId, currency: operation.asset as any, amount: operation.amount.toString() },
          ] });
          await tx.auditLog.create({ data: { userId: operation.userId, action: 'CUSTODY_CONFIRMED_REJECTION', entity: 'OnChainTransaction', entityId: operation.id } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } else if (result.txHash) {
        await prisma.onChainTransaction.updateMany({
          where: { id: operation.id, status: { in: ['BROADCAST_UNKNOWN', 'PENDING'] }, OR: [{ txHash: null }, { txHash: result.txHash }] },
          data: { txHash: result.txHash, status: result.status, ...(result.status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}) },
        });
      }
    } catch {
      // Preserve the existing debit. Never treat an unreachable status API as
      // a rejected payment. The unknown-operation alert remains active.
      logger.error('[custody] reconciliation requires review', { operationId: operation.id });
    }
  }
}

let timer: NodeJS.Timeout | null = null;
let running = false;
export function startCustodyReconciliation() {
  if (timer || custodyMode() !== 'remote') return;
  const run = () => {
    if (running) return;
    running = true;
    void reconcileCustodyWithdrawals().catch(() => logger.error('[custody] reconciliation query failed')).finally(() => { running = false; });
  };
  run();
  timer = setInterval(run, 60_000); timer.unref();
}
