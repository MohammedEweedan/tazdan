/**
 * KYC provider abstraction.
 *
 * Real candidates: Sumsub, Persona, Onfido, Veriff, Jumio.
 * Each provider implements the same interface so route handlers stay neutral.
 *
 * The flow is:
 *   1. createApplicant()  → returns provider's applicant id, store on User
 *   2. createSession()    → returns a hosted URL or token the client opens
 *   3. parseWebhook()     → server-side signal that verification finished;
 *                            translate to our `KYCStatus` + `KYCTier`.
 */

import crypto from 'node:crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import type { KYCStatus, KYCTier } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';

// ─── Sumsub HMAC helper ───────────────────────────────────────────────

function sumsubHeaders(
  method: string,
  urlPath: string,
  body: string,
): Record<string, string> {
  const appToken = process.env.SUMSUB_APP_TOKEN;
  const secret = process.env.SUMSUB_SECRET;
  if (!appToken || !secret) {
    throw new AppError('Sumsub not configured. Set SUMSUB_APP_TOKEN + SUMSUB_SECRET.', 500);
  }
  const ts = Math.floor(Date.now() / 1000).toString();
  const toSign = ts + method.toUpperCase() + urlPath + body;
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest('hex');
  return {
    'X-App-Token': appToken,
    'X-App-Access-Ts': ts,
    'X-App-Access-Sig': sig,
    'Content-Type': 'application/json',
  };
}

export interface CreateApplicantRequest {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  country?: string;            // ISO alpha-2
  dateOfBirth?: string;        // ISO yyyy-mm-dd
}

export interface CreateApplicantResult {
  applicantId: string;
}

export interface CreateSessionRequest {
  applicantId: string;
  level: 'basic' | 'standard' | 'enhanced';   // maps to TIER_1 / TIER_2 / TIER_3
  redirectUrl?: string;
}

export interface CreateSessionResult {
  sessionUrl?: string;        // hosted SDK URL
  sessionToken?: string;      // client SDK token
  expiresAt: Date;
}

export interface KYCWebhookEvent {
  applicantId: string;
  newStatus: KYCStatus;
  awardedTier: KYCTier;
  reasonCode?: string;        // provider's rejection reason
  raw: unknown;
}

export interface KYCProvider {
  readonly name: 'MOCK' | 'SUMSUB' | 'PERSONA' | 'ONFIDO' | 'VERIFF';
  createApplicant(req: CreateApplicantRequest): Promise<CreateApplicantResult>;
  createSession(req: CreateSessionRequest): Promise<CreateSessionResult>;
  parseWebhook(headers: Record<string, string>, rawBody: string): Promise<KYCWebhookEvent>;
}

class MockKYCProvider implements KYCProvider {
  readonly name = 'MOCK' as const;

  async createApplicant(_: CreateApplicantRequest): Promise<CreateApplicantResult> {
    return { applicantId: `mock_app_${uuidv4()}` };
  }

  async createSession(req: CreateSessionRequest): Promise<CreateSessionResult> {
    return {
      sessionUrl: `https://mock-kyc.local/session/${req.applicantId}`,
      sessionToken: `mock_tok_${uuidv4()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  async parseWebhook(_h: Record<string, string>, rawBody: string): Promise<KYCWebhookEvent> {
    const parsed = JSON.parse(rawBody);
    return {
      applicantId: parsed.applicantId ?? 'unknown',
      newStatus: parsed.newStatus ?? 'APPROVED',
      awardedTier: parsed.awardedTier ?? 'TIER_2',
      reasonCode: parsed.reasonCode,
      raw: parsed,
    };
  }
}

class SumsubKYCProvider implements KYCProvider {
  readonly name = 'SUMSUB' as const;

  private get baseUrl(): string {
    return process.env.SUMSUB_BASE_URL ?? 'https://api.sumsub.com';
  }

  async createApplicant(req: CreateApplicantRequest): Promise<CreateApplicantResult> {
    const urlPath = '/resources/applicants?levelName=basic-kyc-level';
    const bodyObj = {
      externalUserId: req.userId,
      email: req.email,
      info: {
        firstName: req.firstName,
        lastName: req.lastName,
        country: req.country,
        dob: req.dateOfBirth,
      },
    };
    const bodyStr = JSON.stringify(bodyObj);
    try {
      const resp = await axios.post<{ id: string }>(
        `${this.baseUrl}${urlPath}`,
        bodyObj,
        { headers: sumsubHeaders('POST', urlPath, bodyStr) },
      );
      return { applicantId: resp.data.id };
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? `Sumsub createApplicant failed: ${err.response?.status} ${JSON.stringify(err.response?.data)}`
        : `Sumsub createApplicant error: ${String(err)}`;
      throw new AppError(msg, 502);
    }
  }

  async createSession(req: CreateSessionRequest): Promise<CreateSessionResult> {
    const levelMap: Record<string, string> = {
      basic: 'basic-kyc-level',
      standard: 'standard-kyc-level',
      enhanced: 'enhanced-kyc-level',
    };
    const levelName = levelMap[req.level] ?? 'basic-kyc-level';
    const urlPath = `/resources/accessTokens?userId=${encodeURIComponent(req.applicantId)}&levelName=${encodeURIComponent(levelName)}`;
    try {
      const resp = await axios.post<{ token: string }>(
        `${this.baseUrl}${urlPath}`,
        '',
        { headers: sumsubHeaders('POST', urlPath, '') },
      );
      const sessionToken = resp.data.token;
      const sessionUrl = `https://cockpit.sumsub.com/checkus#/applicant/${req.applicantId}`;
      return {
        sessionToken,
        sessionUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? `Sumsub createSession failed: ${err.response?.status} ${JSON.stringify(err.response?.data)}`
        : `Sumsub createSession error: ${String(err)}`;
      throw new AppError(msg, 502);
    }
  }

  async parseWebhook(headers: Record<string, string>, rawBody: string): Promise<KYCWebhookEvent> {
    const secret = process.env.SUMSUB_SECRET;
    if (!secret) throw new AppError('SUMSUB_SECRET not configured', 500);

    const receivedSig = headers['x-payload-digest'];
    const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!receivedSig || receivedSig !== expectedSig) {
      throw new AppError('Invalid Sumsub signature', 400);
    }

    const payload = JSON.parse(rawBody) as {
      type: string;
      applicantId: string;
      levelName?: string;
      reviewResult?: { reviewAnswer?: string; rejectLabels?: string[] };
    };

    const tierMap: Record<string, KYCTier> = {
      'basic-kyc-level': 'TIER_1',
      'standard-kyc-level': 'TIER_2',
      'enhanced-kyc-level': 'TIER_3',
    };
    const awardedTier: KYCTier = tierMap[payload.levelName ?? ''] ?? 'TIER_1';

    let newStatus: KYCStatus;
    switch (payload.type) {
      case 'applicantReviewed': {
        const answer = payload.reviewResult?.reviewAnswer;
        newStatus = answer === 'GREEN' ? 'APPROVED' : 'REJECTED';
        break;
      }
      case 'applicantPending':
        newStatus = 'PENDING';
        break;
      default:
        newStatus = 'PENDING';
    }

    const reasonCode = payload.reviewResult?.rejectLabels?.[0];
    return {
      applicantId: payload.applicantId,
      newStatus,
      awardedTier,
      reasonCode,
      raw: payload,
    };
  }
}

let cached: KYCProvider | null = null;

export function getKYCProvider(): KYCProvider {
  if (cached) return cached;
  const name = (process.env.KYC_PROVIDER || 'MOCK').toUpperCase();
  switch (name) {
    case 'SUMSUB': cached = new SumsubKYCProvider(); break;
    case 'MOCK':
    default:       cached = new MockKYCProvider();   break;
  }
  return cached;
}

export function __resetKYCProvider() { cached = null; }
