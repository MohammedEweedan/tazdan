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

import { v4 as uuidv4 } from 'uuid';
import type { KYCStatus, KYCTier } from '@prisma/client';

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
  async createApplicant(_: CreateApplicantRequest): Promise<CreateApplicantResult> { throw new Error('Sumsub not configured. Set SUMSUB_APP_TOKEN + SUMSUB_SECRET.'); }
  async createSession(_: CreateSessionRequest): Promise<CreateSessionResult> { throw new Error('Sumsub not configured.'); }
  async parseWebhook(): Promise<KYCWebhookEvent> { throw new Error('Sumsub not configured.'); }
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
