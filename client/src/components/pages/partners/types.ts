import type { Status } from "@/components/site";

/** The three stages on the partners page, in order. */
export type PartnerStage = "licensing" | "banking" | "pipeline";

/** Kit statuses plus the ones a partner can reach once something is signed.
 *  inProgress — work under way (licensing application)
 *  discussion — conversations open, nothing signed
 *  pipeline   — a prospective partner, no agreement
 *  signed     — an agreement is signed, not yet live for customers
 *  licensed   — a licence has been granted
 *  live       — the partner's service is live for customers */
export type PartnerStatus = Extract<Status, "inProgress" | "discussion" | "pipeline"> | "signed" | "licensed" | "live";

export type StageDef = {
  id: PartnerStage;
  /** i18n keys */
  name: string;
  desc: string;
};

export type PartnerEntry = {
  id: string;
  stage: PartnerStage;
  status: PartnerStatus;
  /** A company's own name, rendered as plain text (never its logo). */
  wordmark?: string;
  /** i18n key for a translated name (used when there is no wordmark). */
  name?: string;
  /** i18n keys */
  role: string;
  means: string;
  next: string;
};

/** How far along a status is — used to pick a stage's lead status. */
export const STATUS_RANK: Record<PartnerStatus, number> = {
  pipeline: 0,
  discussion: 1,
  inProgress: 2,
  signed: 3,
  licensed: 4,
  live: 5,
};
