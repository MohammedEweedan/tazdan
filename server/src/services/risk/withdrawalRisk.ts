/**
 * Risk assessment for withdrawals (money leaving Tazdan).
 *
 * Screens the customer and, for crypto, the destination address against the
 * loaded watchlists, then runs the risk engine with subject WITHDRAWAL.
 * Blocking outcomes open a compliance case; review outcomes open one too, so
 * the decision is visible in the compliance queue. Callers decide what a
 * review outcome means for their path (the instant on-chain path refuses;
 * the staff-approved path continues into the approval queue with a note).
 */
import { randomUUID } from 'crypto';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { usdRate } from '../../utils/kycLimits';
import { evaluateRisk } from './engine';
import { screenAndRecord } from '../compliance/screening.service';
import { openCase } from '../compliance/cases.service';
import { deviceFingerprint, isKnownDevice } from '../security/stepUp.service';

const BLOCKING = ['REJECT', 'BLOCK', 'FREEZE'];
const REVIEW = ['REVIEW', 'REQUEST_INFORMATION', 'CHALLENGE', 'DELAY'];

export interface WithdrawalRisk {
  decisionId: string;
  outcome: string;
  score: number;
  explanation: string;
  blocked: boolean;
  review: boolean;
  subjectId: string;
}

export async function assessWithdrawal(input: {
  userId: string;
  amount: string | number;
  currency: string;
  walletAddress?: string | null;
  req: { headers: Record<string, any> };
  /** Existing withdrawal id when known; otherwise a reference is generated. */
  subjectId?: string;
}): Promise<WithdrawalRisk> {
  const subjectId = input.subjectId ?? `wd_${randomUUID()}`;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId }, select: { firstName: true, lastName: true, country: true, dateOfBirth: true } });
  const rate = await usdRate(input.currency).catch(() => 0);
  const amountUsd = Number(input.amount) * (rate || 1);

  const sender = await screenAndRecord({
    subjectType: 'USER', subjectId: input.userId, userId: input.userId,
    subject: { name: `${user.firstName} ${user.lastName}`, country: user.country, dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) },
  });
  const destination = input.walletAddress
    ? await screenAndRecord({ subjectType: 'WALLET_ADDRESS', subjectId: input.walletAddress, userId: input.userId, subject: { name: '', walletAddress: input.walletAddress } })
    : null;

  const fp = deviceFingerprint(input.req);
  const risk = await evaluateRisk({
    subjectType: 'WITHDRAWAL', subjectId, userId: input.userId, amountUsd,
    sourceCountry: user.country,
    knownDevice: await isKnownDevice(input.userId, fp), deviceFingerprint: fp,
    screening: {
      sender: sender.status,
      beneficiary: destination?.status,
      coverage: sender.listsChecked.length ? 'LISTS_LOADED' : 'NO_LISTS_LOADED',
    },
  });
  const blocked = BLOCKING.includes(risk.outcome);
  const review = !blocked && REVIEW.includes(risk.outcome);
  if (blocked || review) {
    await openCase({
      type: risk.triggered.some((r) => r.startsWith('SANCTIONS')) ? 'SANCTIONS' : 'AML',
      priority: blocked ? 'HIGH' : 'MEDIUM',
      title: `Withdrawal of ${input.amount} ${input.currency} ${blocked ? 'blocked' : 'flagged for review'} by the risk engine`,
      summary: `${risk.explanation}${input.walletAddress ? `\nDestination: ${input.walletAddress}` : ''}`,
      subjectUserId: input.userId, subjectType: 'WITHDRAWAL', subjectId, riskDecisionId: risk.decisionId,
    }).catch((err) => logger.warn('[risk] could not open withdrawal case', { err: (err as Error).message }));
  }
  return { decisionId: risk.decisionId, outcome: risk.outcome, score: risk.score, explanation: risk.explanation, blocked, review, subjectId };
}
