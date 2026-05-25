/**
 * B2B / Business account domain types.
 * Mirrors the server's BusinessController + ApiKeyController response shapes.
 */

export type ApiKeyPermission =
  | 'PAYOUTS'         // create / query payouts
  | 'BALANCES'        // read wallet balances
  | 'RATES'           // query FX rates
  | 'WEBHOOKS'        // manage webhook endpoints
  | 'READ_ONLY';      // read anything, write nothing

export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface BusinessApiKey {
  id:          string;
  name:        string;
  prefix:      string;          // e.g. "ftb_live_"
  last4:       string;          // last 4 chars of the raw key
  permissions: ApiKeyPermission[];
  status:      ApiKeyStatus;
  expiresAt:   string | null;
  lastUsedAt:  string | null;
  createdAt:   string;
}

/** Only returned once at creation — store it immediately. */
export interface ApiKeyCreateResponse extends BusinessApiKey {
  rawKey: string;
}

export type TeamRole = 'OWNER' | 'ADMIN' | 'ANALYST' | 'DEVELOPER';

export interface TeamMember {
  id:        string;
  userId:    string | null;      // null = pending invite
  email:     string;
  role:      TeamRole;
  status:    'ACTIVE' | 'PENDING' | 'SUSPENDED';
  joinedAt:  string | null;
  invitedAt: string;
  user?: {
    firstName: string;
    lastName:  string;
    avatarUrl: string | null;
    username:  string | null;
  } | null;
}

export type PayoutStatus =
  | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BusinessPayout {
  id:              string;
  reference:       string;
  recipientHandle: string | null;
  recipientEmail:  string | null;
  amount:          string;
  currency:        string;
  feeAmount:       string;
  netAmount:       string;
  status:          PayoutStatus;
  note:            string | null;
  batchId:         string | null;
  createdAt:       string;
  completedAt:     string | null;
}

export interface BulkPayRecipient {
  handle?: string;           // @handle OR email required
  email?:  string;
  amount:  number;
  currency: string;
  note?:   string;
}

export interface BulkPayPreview {
  recipients:  number;
  totalAmount: string;
  totalFee:    string;
  currency:    string;
  valid:       BulkPayRecipient[];
  invalid:     Array<{ row: number; reason: string }>;
}

export interface BusinessStats {
  payoutsToday:     number;
  payoutsThisMonth: number;
  volumeUsdToday:   string;
  volumeUsdMonth:   string;
  apiCallsToday:    number;
  teamSize:         number;
  activeKeys:       number;
  successRate:      number;     // 0–1
}

export interface BusinessProfile {
  id:            string;
  legalName:     string;
  tradingName:   string | null;
  country:       string;
  kybStatus:     'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  website:       string | null;
  logoUrl:       string | null;
  createdAt:     string;
}

export interface WebhookEndpoint {
  id:        string;
  url:       string;
  events:    string[];
  status:    'ACTIVE' | 'DISABLED';
  secret:    string;            // shown once at creation
  createdAt: string;
}
