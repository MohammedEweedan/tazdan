/**
 * Repair ledger groups that no longer balance.
 *
 * The database rejects unbalanced journals at commit, but groups written
 * before that trigger existed can still be one-sided — typically because test
 * users were deleted and their USER legs went with them (cascade), leaving the
 * system leg behind. The ledger reconciliation then reports a conservation
 * break and halts trading on every run.
 *
 * Nothing is deleted or edited (entries are append-only). For each unbalanced
 * (group, currency) the script adds one SUSPENSE leg to the same group that
 * brings it back to zero, so the residue is visible and can be investigated.
 *
 *   npx ts-node --transpile-only scripts/repair-unbalanced-ledger-groups.ts            # report only
 *   npx ts-node --transpile-only scripts/repair-unbalanced-ledger-groups.ts --apply    # write the legs
 *   … --apply --clear-halt   also lifts the trading halt once the books balance
 *
 * In production, run the report first and get the residue explained; the
 * SUSPENSE balance must then be cleared by a maker-checked adjustment.
 */
import dotenv from 'dotenv';
dotenv.config();

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/utils/prisma';
import { resolveAccount } from '../src/services/ledger/ledger.service';
import { reconcileLedger, setTradingHalt } from '../src/services/ledger/reconcile.service';

const APPLY = process.argv.includes('--apply');
const CLEAR_HALT = process.argv.includes('--clear-halt');

async function main() {
  const broken = await prisma.$queryRaw<Array<{ groupId: string; currency: string; sum: string; refTypes: string; legs: number }>>`
    SELECT "groupId", "currency"::text AS currency, SUM("amount")::text AS sum,
           string_agg(DISTINCT "refType", ',') AS "refTypes", COUNT(*)::int AS legs
    FROM "LedgerEntry" GROUP BY 1, 2
    HAVING ABS(SUM("amount")) > 0.000000000001
    ORDER BY 2, 1
  `;
  const db = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  console.log(`\nDatabase: ${db}. Unbalanced groups: ${broken.length}`);
  for (const b of broken) console.log(`  ${b.groupId}  ${b.currency.padEnd(5)} ${b.sum.padStart(28)}  ${b.refTypes} (${b.legs} leg${b.legs === 1 ? '' : 's'})`);
  if (!broken.length) { console.log('Nothing to repair.'); return; }
  if (!APPLY) { console.log('\nReport only. Re-run with --apply to add the balancing SUSPENSE legs.'); return; }

  await prisma.$transaction(async (tx) => {
    for (const b of broken) {
      const residue = new Decimal(b.sum);
      const acct = await resolveAccount(tx as any, 'SUSPENSE', b.currency as any);
      await tx.ledgerEntry.create({
        data: {
          groupId: b.groupId, accountId: acct.id, currency: b.currency as any, amount: residue.neg().toFixed(),
          refType: 'ledger_repair', refId: b.groupId, memo: `Balancing leg for one-sided group (${b.refTypes}); residue held in suspense for investigation`,
        },
      });
      await tx.ledgerAccount.update({ where: { id: acct.id }, data: { balance: { increment: residue.neg().toFixed() } } });
    }
    await tx.auditLog.create({ data: { action: 'LEDGER_REPAIR_UNBALANCED_GROUPS', entity: 'LedgerEntry', newValues: { groups: broken } as any } });
  });
  const after = await reconcileLedger();
  console.log(`\nAdded ${broken.length} SUSPENSE leg(s). Conservation: ${after.conservation.length ? `still broken ${JSON.stringify(after.conservation)}` : 'balanced'}. Cache drift: ${after.cacheDrift.length}.`);
  if (CLEAR_HALT && after.ok) {
    await setTradingHalt(false, 'cleared after ledger repair');
    console.log('Trading halt cleared.');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
