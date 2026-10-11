/**
 * remittanceService — HTTP wrapper for /api/remittance/* (send money abroad).
 *
 * The server owns pricing (immutable quotes), compliance screening, risk
 * checks and routing. A transfer's raw `state` is never shown to the
 * customer directly — use `customerStatus()` for wording.
 */
import { api } from '@/lib/api';

export interface Corridor {
  code: string;
  name: string;
  sourceCurrency: string;
  destCurrency: string;
  destCountry: string;
  direction: string;
  status: 'LIVE' | 'SANDBOX_ONLY' | 'PAUSED' | 'DISABLED';
  available: boolean;
  sandbox: boolean;
  minAmount: string;
  maxAmount: string;
  payoutMethods: string[];
  purposes: string[];
  quoteTtlSeconds: number;
}

export type PayoutMethod = 'BANK_ACCOUNT' | 'MOBILE_WALLET' | 'CASH_PICKUP' | 'TAZDAN_WALLET';

export interface Beneficiary {
  id: string;
  fullName: string;
  relationship: string | null;
  country: string;
  currency: string;
  payoutMethod: PayoutMethod;
  bankName: string | null;
  accountNumber: string | null;
  iban: string | null;
  sortCode: string | null;
  mobileWallet: string | null;
  createdAt: string;
}

export interface Quote {
  id: string;
  corridor: { code: string; name: string };
  sendAmount: string;
  feeAmount: string;
  totalDebit: string;
  customerRate: string;
  receiveAmount: string;
  expiresAt: string;
  estimatedDeliveryMinutes: number | null;
  payoutAvailable: boolean;
  sandbox: boolean;
}

export interface RemittanceTransfer {
  id: string;
  reference: string;
  state: string;
  sourceCurrency: string;
  destCurrency: string;
  sendAmount: string;
  feeAmount: string;
  totalDebit: string;
  customerRate: string;
  receiveAmount: string;
  purpose: string;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  refundedAt: string | null;
  failureReason: string | null;
  corridor?: { code: string; name: string; status: string };
  beneficiary?: { id: string; fullName: string; country: string; payoutMethod: PayoutMethod };
  sandbox?: boolean;
}

/**
 * Customer-facing status. Internal states (compliance review, routing,
 * settlement, reconciliation) are deliberately collapsed: a customer is never
 * told their transfer is under compliance review.
 */
export function customerStatus(state: string): { label: string; tone: 'progress' | 'done' | 'problem' | 'neutral' } {
  switch (state) {
    case 'PAID': case 'RECONCILIATION_PENDING': case 'RECONCILED': case 'COMPLETED':
      return { label: 'Delivered', tone: 'done' };
    case 'REFUNDED':
      return { label: 'Refunded', tone: 'neutral' };
    case 'REFUND_PENDING':
      return { label: 'Refund in progress', tone: 'progress' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'EXPIRED':
      return { label: 'Expired', tone: 'neutral' };
    case 'REJECTED':
      return { label: 'Not completed', tone: 'problem' };
    case 'FAILED':
      return { label: 'Delayed', tone: 'problem' };
    case 'DISPUTED':
      return { label: 'Under investigation', tone: 'problem' };
    default:
      return { label: 'Processing', tone: 'progress' };
  }
}

export const remittanceService = {
  corridors: async (): Promise<Corridor[]> => (await api.get('/remittance/corridors')).data.corridors ?? [],
  beneficiaries: async (): Promise<Beneficiary[]> => (await api.get('/remittance/beneficiaries')).data.beneficiaries ?? [],
  addBeneficiary: async (payload: {
    fullName: string; relationship?: string; country: string; currency: string; payoutMethod: PayoutMethod;
    bankName?: string; accountNumber?: string; iban?: string; sortCode?: string; mobileWallet?: string; tazdanHandle?: string;
  }): Promise<Beneficiary> => (await api.post('/remittance/beneficiaries', payload)).data.beneficiary,
  removeBeneficiary: async (id: string) => { await api.delete(`/remittance/beneficiaries/${id}`); },
  quote: async (payload: { corridorCode: string; sendAmount: number; beneficiaryId?: string }): Promise<Quote> =>
    (await api.post('/remittance/quotes', payload)).data.quote,
  create: async (payload: {
    quoteId: string; beneficiaryId: string; purpose: string; sourceOfFunds?: string; idempotencyKey: string;
    stepUpCode?: string; biometricVerified?: boolean;
  }): Promise<{ transfer: RemittanceTransfer; duplicate: boolean }> => (await api.post('/remittance/transfers', payload)).data,
  list: async (): Promise<RemittanceTransfer[]> => (await api.get('/remittance/transfers')).data.transfers ?? [],
  get: async (id: string): Promise<{ transfer: RemittanceTransfer; timeline: Array<{ state: string; at: string }> }> =>
    (await api.get(`/remittance/transfers/${id}`)).data,
  cancel: async (id: string): Promise<RemittanceTransfer> => (await api.post(`/remittance/transfers/${id}/cancel`)).data.transfer,
};
