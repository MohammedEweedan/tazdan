/**
 * Wire types for the in-app messaging API.
 * Mirror `MessageController.toWire()` on the server.
 */

export type MessageType = 'TEXT' | 'PAYMENT' | 'SYSTEM' | 'P2P_NOTE' | 'ESCALATION';

export interface PaymentMetadata {
  amount: number;
  currency: string;
  txRef?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  /** Free-form note shown under the receipt. */
  note?: string;
}

export interface ApiMessage {
  id: string;
  senderId: string;
  receiverId: string;
  /** Empty string when `deletedAt` is set — render as "Message deleted". */
  content: string;
  type: MessageType;
  metadata: Record<string, any> | null;
  isRead: boolean;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  tradeId: string | null;
  createdAt: string;
}

export interface ConversationPartner {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string | null;
  avatarUrl?: string | null;
  role?: string;
  kycStatus?: string;
}

export interface Conversation {
  partner: ConversationPartner;
  lastMessage: ApiMessage;
  unread: number;
}

export interface BlockedUser {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string | null;
  createdAt: string;
  blocked: ConversationPartner;
}

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'SCAM_FRAUD'
  | 'IMPERSONATION'
  | 'INAPPROPRIATE'
  | 'OTHER';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'SPAM',           label: 'Spam or unsolicited messages' },
  { key: 'HARASSMENT',     label: 'Harassment or bullying' },
  { key: 'SCAM_FRAUD',     label: 'Scam or fraud' },
  { key: 'IMPERSONATION',  label: 'Impersonation' },
  { key: 'INAPPROPRIATE',  label: 'Inappropriate content' },
  { key: 'OTHER',          label: 'Other' },
];
