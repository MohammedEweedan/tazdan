import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { auditFundIntegrity } from '../ledger/fundIntegrity.service';
import { isTradingHalted, reconcileLedger } from '../ledger/reconcile.service';
import { fulusCachedRates } from '../exchange/fulus.service';

type Status = 'ok' | 'warn' | 'critical';

function worst(...statuses: Status[]): Status {
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warn')) return 'warn';
  return 'ok';
}

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ageMs(date?: Date | null): number | null {
  return date ? Date.now() - date.getTime() : null;
}

async function setting(key: string): Promise<string | null> {
  const row = await prisma.platformSettings.findUnique({ where: { key } }).catch(() => null);
  return row?.value ?? null;
}

async function latestDailyClose() {
  return prisma.platformSettings.findFirst({
    where: { key: { startsWith: 'daily_close_' } },
    orderBy: { updatedAt: 'desc' },
  }).catch(() => null);
}

export async function buildOperationalReadiness() {
  const staleFxMs = num(await setting('alert_stale_fx_ms'), 5 * 60_000);
  const supportFirstResponseMs = num(await setting('support_first_response_sla_ms'), 2 * 60 * 60_000);
  const supportResolveMs = num(await setting('support_resolution_sla_ms'), 24 * 60 * 60_000);
  const failedWebhookWindowMs = num(await setting('alert_webhook_failure_window_ms'), 60 * 60_000);
  const now = new Date();
  const failedSince = new Date(Date.now() - failedWebhookWindowMs);

  const [
    funds,
    ledger,
    tradingHalted,
    exchangeRates,
    fulusRates,
    failedOnRamps,
    failedOffRamps,
    failedOnChain,
    queuedOnChain,
    pendingWithdrawals,
    openEscalations,
    lastAuditReview,
    close,
    walletExposure,
    platformFees,
    recentAuditLogs,
  ] = await Promise.all([
    auditFundIntegrity({ haltOnBreach: false }),
    reconcileLedger(),
    isTradingHalted(),
    prisma.exchangeRate.findMany({ where: { isActive: true }, orderBy: { updatedAt: 'asc' } }),
    Promise.resolve(fulusCachedRates()),
    (prisma as any).onRampTransaction.count({ where: { status: 'FAILED', updatedAt: { gte: failedSince } } }).catch(() => 0),
    (prisma as any).offRampTransaction.count({ where: { status: 'FAILED', updatedAt: { gte: failedSince } } }).catch(() => 0),
    prisma.onChainTx.count({ where: { status: 'FAILED', updatedAt: { gte: failedSince } } }).catch(() => 0),
    prisma.onChainTx.count({ where: { status: 'QUEUED' } }).catch(() => 0),
    prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    (prisma as any).supportEscalation.findMany({
      where: { status: { in: ['OPEN', 'ASSIGNED'] } },
      select: { id: true, status: true, assignedAgentId: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }).catch(() => []),
    prisma.auditLog.findFirst({ where: { action: 'AUDIT_LOG_REVIEW' }, orderBy: { createdAt: 'desc' } }).catch(() => null),
    latestDailyClose(),
    prisma.wallet.groupBy({ by: ['currency'], _sum: { balance: true, frozen: true } }),
    (prisma as any).platformFee.aggregate({ _sum: { amountUsd: true }, _count: { id: true } }).catch(() => null),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }).catch(() => []),
  ]);

  const staleExchangeRates = exchangeRates
    .map((r) => ({
      pair: `${r.baseCurrency}/${r.quoteCurrency}`,
      updatedAt: r.updatedAt,
      ageMs: ageMs(r.updatedAt) ?? 0,
      source: r.setBy ? `manual:${r.setBy}` : 'auto',
    }))
    .filter((r) => r.ageMs > staleFxMs);
  const staleFulusRates = Object.entries(fulusRates)
    .map(([currency, value]) => ({ pair: `${currency}/LYD`, ageMs: value.ageMs, source: value.source }))
    .filter((r) => r.ageMs > staleFxMs);

  const exposureByCurrency = walletExposure.map((row) => ({
    currency: row.currency,
    balance: new Decimal((row._sum.balance ?? 0).toString()).toString(),
    frozen: new Decimal((row._sum.frozen ?? 0).toString()).toString(),
  }));

  const hotWalletLimits = await Promise.all(exposureByCurrency.map(async (row) => {
    const limit = num(await setting(`hot_wallet_limit_${row.currency}`), row.currency === 'USDT' ? 50_000 : 0);
    const balance = Number(row.balance);
    return {
      currency: row.currency,
      balance: row.balance,
      limit: String(limit),
      status: limit > 0 && balance > limit ? 'critical' as Status : 'ok' as Status,
    };
  }));

  const unassignedBreaches = openEscalations.filter((e: any) =>
    !e.assignedAgentId && (ageMs(e.createdAt) ?? 0) > supportFirstResponseMs,
  );
  const resolutionBreaches = openEscalations.filter((e: any) =>
    (ageMs(e.createdAt) ?? 0) > supportResolveMs,
  );

  const reconciliationStatus: Status = funds.ok && ledger.ok && !tradingHalted ? 'ok' : 'critical';
  const fxStatus: Status = staleExchangeRates.length || staleFulusRates.length ? 'warn' : 'ok';
  const webhookStatus: Status = failedOnRamps + failedOffRamps + failedOnChain > 0 ? 'critical' : 'ok';
  const supportStatus: Status = resolutionBreaches.length ? 'critical' : unassignedBreaches.length ? 'warn' : 'ok';
  const hotWalletStatus: Status = hotWalletLimits.some((r) => r.status === 'critical') ? 'critical' : 'ok';
  const auditReviewAge = ageMs(lastAuditReview?.createdAt);
  const auditStatus: Status = auditReviewAge == null || auditReviewAge > 7 * 24 * 60 * 60_000 ? 'warn' : 'ok';
  const closeAge = ageMs(close?.updatedAt);
  const dailyCloseStatus: Status = closeAge == null || closeAge > 30 * 60 * 60_000 ? 'warn' : 'ok';

  return {
    generatedAt: now.toISOString(),
    overall: worst(reconciliationStatus, fxStatus, webhookStatus, supportStatus, hotWalletStatus, auditStatus, dailyCloseStatus),
    controls: {
      reconciliation: { status: reconciliationStatus, tradingHalted, funds, ledger },
      dailyClose: {
        status: dailyCloseStatus,
        lastCloseKey: close?.key ?? null,
        lastClosedAt: close?.updatedAt ?? null,
      },
      alerts: {
        balanceDrift: { status: reconciliationStatus, fundBreaches: funds.perCurrency.filter((c) => !c.ok), ledgerBreaches: ledger.conservation },
        providerWebhookFailures: { status: webhookStatus, failedOnRamps, failedOffRamps, failedOnChain, windowMs: failedWebhookWindowMs },
        staleFxRates: { status: fxStatus, staleExchangeRates, staleFulusRates, thresholdMs: staleFxMs },
      },
      liquidityExposure: {
        status: 'ok' as Status,
        byCurrency: exposureByCurrency,
        feesUsd: String(platformFees?._sum?.amountUsd ?? 0),
        feeEvents: platformFees?._count?.id ?? 0,
      },
      hotWalletLimits: { status: hotWalletStatus, limits: hotWalletLimits },
      adminApprovals: {
        status: pendingWithdrawals > 0 || queuedOnChain > 0 ? 'warn' as Status : 'ok' as Status,
        pendingWithdrawals,
        queuedOnChain,
        withdrawalMultisigUsd: Number(process.env.WITHDRAWAL_MULTISIG_USD ?? '10000'),
        withdrawalMultisigN: Number(process.env.WITHDRAWAL_MULTISIG_N ?? '2'),
      },
      supportSlas: {
        status: supportStatus,
        open: openEscalations.length,
        unassignedBreaches: unassignedBreaches.length,
        resolutionBreaches: resolutionBreaches.length,
        firstResponseMs: supportFirstResponseMs,
        resolutionMs: supportResolveMs,
      },
      auditReview: {
        status: auditStatus,
        lastReviewedAt: lastAuditReview?.createdAt ?? null,
        recent: recentAuditLogs.map((row) => ({
          id: row.id,
          action: row.action,
          entity: row.entity,
          userId: row.userId,
          createdAt: row.createdAt,
        })),
      },
      incidentRunbooks: {
        status: 'ok' as Status,
        files: [
          'docs/runbooks/balance-drift.md',
          'docs/runbooks/provider-webhook-failure.md',
          'docs/runbooks/stale-fx-rate.md',
          'docs/runbooks/hot-wallet-limit.md',
        ],
      },
    },
  };
}

export async function runDailyClose(adminId: string, date = new Date()) {
  const closeDate = date.toISOString().slice(0, 10);
  const report = await buildOperationalReadiness();
  const key = `daily_close_${closeDate}`;
  await prisma.platformSettings.upsert({
    where: { key },
    update: {
      value: JSON.stringify(report),
      description: `Daily close snapshot for ${closeDate}`,
      updatedBy: adminId,
    },
    create: {
      key,
      value: JSON.stringify(report),
      description: `Daily close snapshot for ${closeDate}`,
      updatedBy: adminId,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'DAILY_CLOSE',
      entity: 'operations',
      entityId: key,
      newValues: { closeDate, overall: report.overall } as any,
    },
  }).catch(() => {});
  return { key, closeDate, report };
}

export async function markAuditLogReviewed(adminId: string, note?: string) {
  return prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'AUDIT_LOG_REVIEW',
      entity: 'audit_log',
      newValues: { note: note ?? null } as any,
    },
  });
}
