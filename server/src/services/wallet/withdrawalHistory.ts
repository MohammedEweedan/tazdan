/**
 * A withdrawal has ONE customer history row: the Transaction written when it
 * was requested. Later steps update that row's status instead of adding
 * another row, so history never shows a withdrawal twice and a cancelled or
 * rejected request is labelled as such rather than looking like money left.
 */
import type { Prisma } from '@prisma/client';

export type WithdrawalHistoryStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

export async function markWithdrawalHistory(
  tx: Prisma.TransactionClient,
  reference: string,
  status: WithdrawalHistoryStatus,
): Promise<number> {
  const rows = await tx.transaction.findMany({
    where: { reference, type: 'WITHDRAWAL' },
    select: { id: true, metadata: true },
  });
  for (const row of rows) {
    const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
    await tx.transaction.update({
      where: { id: row.id },
      data: { metadata: { ...metadata, status, statusAt: new Date().toISOString() } as Prisma.InputJsonValue },
    });
  }
  return rows.length;
}
