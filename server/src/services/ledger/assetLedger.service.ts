/**
 * Dynamic-asset double-entry ledger.
 *
 * The main LedgerAccount table is intentionally tied to Prisma's finite
 * Currency enum. This service mirrors the same invariant for arbitrary
 * crypto/meme tickers stored in UserWallet.altBalances, so PEPE/SHIB/etc.
 * do not bypass accounting just because they are not in the enum.
 */
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';

export type AssetAccountType =
  | 'USER'
  | 'PLATFORM'
  | 'SYSTEM_ONRAMP'
  | 'SYSTEM_OFFRAMP'
  | 'SYSTEM_CHAIN'
  | 'SYSTEM_FX'
  | 'SYSTEM_ESCROW';

export interface AssetLeg {
  type: AssetAccountType;
  userId?: string | null;
  asset: string;
  amount: Decimal | string | number;
}

export interface AssetPostInput {
  refType: string;
  refId?: string | null;
  memo?: string;
  legs: AssetLeg[];
}

export type AssetTx = Prisma.TransactionClient;

const EPS = new Decimal('0.000000000001');

export function normaliseAsset(asset: string): string {
  return asset.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '');
}

export function isDynamicAsset(asset: string): boolean {
  const a = normaliseAsset(asset);
  return Boolean(a) && ![
    'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
    'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD',
  ].includes(a);
}

async function resolveAssetAccount(
  tx: AssetTx,
  type: AssetAccountType,
  asset: string,
  userId: string | null = null,
): Promise<{ id: string; balance: Decimal }> {
  const normalised = normaliseAsset(asset);
  const existing = await tx.$queryRaw<Array<{ id: string; balance: unknown }>>`
    SELECT "id", "balance"
    FROM "AssetLedgerAccount"
    WHERE "type" = ${type} AND "asset" = ${normalised}
      AND (("userId" = ${userId}) OR ("userId" IS NULL AND ${userId} IS NULL))
    LIMIT 1
  `;
  if (existing[0]) {
    return { id: existing[0].id, balance: new Decimal(existing[0].balance?.toString() ?? '0') };
  }

  const id = `alacct_${uuidv4()}`;
  await tx.$executeRaw`
    INSERT INTO "AssetLedgerAccount" ("id", "type", "userId", "asset")
    VALUES (${id}, ${type}, ${userId}, ${normalised})
    ON CONFLICT DO NOTHING
  `;
  const row = await tx.$queryRaw<Array<{ id: string; balance: unknown }>>`
    SELECT "id", "balance"
    FROM "AssetLedgerAccount"
    WHERE "type" = ${type} AND "asset" = ${normalised}
      AND (("userId" = ${userId}) OR ("userId" IS NULL AND ${userId} IS NULL))
    LIMIT 1
  `;
  if (!row[0]) throw new Error(`asset ledger account could not be resolved: ${type}:${userId ?? 'SYSTEM'}:${normalised}`);
  return { id: row[0].id, balance: new Decimal(row[0].balance?.toString() ?? '0') };
}

function keyFor(leg: AssetLeg): string {
  return `${leg.type}:${leg.userId ?? 'SYSTEM'}:${normaliseAsset(leg.asset)}`;
}

export async function postAssetLedger(
  tx: AssetTx,
  input: AssetPostInput,
  opts: { allowNegativeUser?: boolean } = {},
): Promise<{ groupId: string }> {
  if (!input.legs.length) throw new Error('postAssetLedger: no legs');
  const allowNegativeUser = Boolean(opts.allowNegativeUser) && process.env.LEDGER_ALLOW_NEGATIVE_USER !== '0';

  const perAsset = new Map<string, Decimal>();
  for (const leg of input.legs) {
    const asset = normaliseAsset(leg.asset);
    if (!asset) throw new Error('postAssetLedger: blank asset');
    const amt = new Decimal(leg.amount.toString());
    perAsset.set(asset, (perAsset.get(asset) ?? new Decimal(0)).plus(amt));
  }
  for (const [asset, sum] of perAsset) {
    if (sum.abs().gt(EPS)) {
      throw new Error(`Asset ledger imbalance for ${asset}: legs sum to ${sum.toString()} refType=${input.refType}`);
    }
  }

  const groupId = `alg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const agg = new Map<string, { leg: AssetLeg; amount: Decimal }>();
  const affectedUsers = new Map<string, { userId: string; asset: string }>();
  for (const leg of input.legs) {
    const k = keyFor(leg);
    const amt = new Decimal(leg.amount.toString());
    const cur = agg.get(k);
    if (cur) cur.amount = cur.amount.plus(amt);
    else agg.set(k, { leg: { ...leg, asset: normaliseAsset(leg.asset) }, amount: amt });
  }

  for (const { leg, amount } of agg.values()) {
    if (amount.isZero()) continue;
    const acct = await resolveAssetAccount(tx, leg.type, leg.asset, leg.userId ?? null);

    if (leg.type === 'USER' && !allowNegativeUser && amount.lt(0) && acct.balance.lt(amount.abs())) {
      throw new Error(`Insufficient ${leg.asset} asset-ledger balance for user ${leg.userId}: need ${amount.abs().toString()}`);
    }

    await tx.$executeRaw`
      UPDATE "AssetLedgerAccount"
      SET "balance" = "balance" + ${new Prisma.Decimal(amount.toFixed(18))}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${acct.id}
    `;
    await tx.$executeRaw`
      INSERT INTO "AssetLedgerEntry" ("id", "groupId", "accountId", "asset", "amount", "refType", "refId", "memo")
      VALUES (
        ${`alent_${uuidv4()}`},
        ${groupId},
        ${acct.id},
        ${leg.asset},
        ${new Prisma.Decimal(amount.toFixed(18))},
        ${input.refType},
        ${input.refId ?? null},
        ${input.memo ?? null}
      )
    `;
    if (leg.type === 'USER' && leg.userId) {
      affectedUsers.set(`${leg.userId}:${leg.asset}`, { userId: leg.userId, asset: leg.asset });
    }
  }

  if (process.env.LEDGER_SYNC_WALLET_READ_MODEL !== '0' && (tx as any).userWallet?.upsert) {
    for (const { userId, asset } of affectedUsers.values()) {
      const rows = await tx.$queryRaw<Array<{ balance: unknown }>>`
        SELECT "balance"
        FROM "AssetLedgerAccount"
        WHERE "type" = 'USER' AND "userId" = ${userId} AND "asset" = ${asset}
        LIMIT 1
      `;
      const balance = new Decimal(rows[0]?.balance?.toString() ?? '0');
      const uw = await (tx as any).userWallet.upsert({
        where: { userId },
        update: {},
        create: { userId, altBalances: {} },
      });
      const alts = (uw.altBalances && typeof uw.altBalances === 'object' ? uw.altBalances : {}) as Record<string, string>;
      const formatted = balance.isZero() ? '0' : balance.toFixed(18).replace(/\.?0+$/, '');
      await (tx as any).userWallet.update({
        where: { userId },
        data: { altBalances: { ...alts, [asset]: formatted } },
      });
    }
  }

  return { groupId };
}
