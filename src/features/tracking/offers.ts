/**
 * Offer side effects. docs/04-DATA-MODEL.md → Automatic side effects.
 * Dates are calendar days stored as UTC midnight, same as deadlines.
 */

import type { JobStatus, PayPeriod } from "@/generated/prisma/enums";
import { formatDeadlineDate } from "@/features/jobs/dates";

export const OFFER_DECISIONS = [
  "PENDING",
  "NEGOTIATING",
  "ACCEPTED",
  "DECLINED",
] as const;

export type OfferDecision = (typeof OFFER_DECISIONS)[number];

/** Caps: docs/04-DATA-MODEL.md → Offer fields. */
export const OFFER_LIMITS = {
  salary: 2_147_483_647,
  bonus: 120,
  equity: 120,
  benefits: 5_000,
  notes: 5_000,
} as const;

const ADVANCE_TO_OFFER: ReadonlySet<JobStatus> = new Set([
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEWING",
]);

export type OfferReminderPlan = "keep" | "upsert" | "dismiss";

export type OfferEffectPlan = {
  /** First save only. */
  receivedEvent: boolean;
  /** Move Saved, Applied, Screening, or Interviewing to Offer. */
  advanceToOffer: boolean;
  reminder: OfferReminderPlan;
  reminderDueAt: Date | null;
};

/** Reminder due at the respond-by instant minus 2 calendar days. */
export function offerResponseDue(respondBy: Date): Date {
  const due = new Date(respondBy.getTime());
  due.setUTCDate(due.getUTCDate() - 2);
  return due;
}

/**
 * Side effects for one create or edit.
 * `previousRespondBy` is null on create.
 */
export function planOfferEffects(input: {
  creating: boolean;
  status: JobStatus;
  previousRespondBy: Date | null;
  nextRespondBy: Date | null;
}): OfferEffectPlan {
  const previousMs = input.previousRespondBy?.getTime() ?? null;
  const nextMs = input.nextRespondBy?.getTime() ?? null;
  const dateChanged = previousMs !== nextMs;

  let reminder: OfferReminderPlan = "keep";
  let reminderDueAt: Date | null = null;
  if (input.nextRespondBy === null && input.previousRespondBy !== null) {
    reminder = "dismiss";
  } else if (input.nextRespondBy !== null && (input.creating || dateChanged)) {
    reminder = "upsert";
    reminderDueAt = offerResponseDue(input.nextRespondBy);
  }

  return {
    receivedEvent: input.creating,
    advanceToOffer: input.creating && ADVANCE_TO_OFFER.has(input.status),
    reminder,
    reminderDueAt,
  };
}

/** The Offer tab is listed for an offer, for Offer or Accepted, or when the URL asks for it. */
export function offerTabVisible(input: {
  status: JobStatus;
  hasOffer: boolean;
  tab: string | null;
}): boolean {
  return (
    input.hasOffer ||
    input.status === "OFFER" ||
    input.status === "ACCEPTED" ||
    input.tab === "offer"
  );
}

export type OfferRow = {
  id: string;
  baseSalary: number | null;
  currency: string | null;
  payPeriod: PayPeriod | null;
  bonus: string | null;
  equity: string | null;
  benefits: string | null;
  startDate: Date | null;
  respondBy: Date | null;
  decision: OfferDecision;
  notes: string | null;
};

/** Form-ready strings. Blank fields are empty. */
export type OfferView = {
  id: string;
  baseSalary: string;
  currency: string;
  payPeriod: PayPeriod | null;
  bonus: string;
  equity: string;
  benefits: string;
  startDate: string;
  respondBy: string;
  decision: OfferDecision;
  notes: string;
};

export function presentOffer(row: OfferRow): OfferView {
  return {
    id: row.id,
    baseSalary: row.baseSalary === null ? "" : String(row.baseSalary),
    currency: row.currency ?? "",
    payPeriod: row.payPeriod,
    bonus: row.bonus ?? "",
    equity: row.equity ?? "",
    benefits: row.benefits ?? "",
    startDate: row.startDate ? formatDeadlineDate(row.startDate) : "",
    respondBy: row.respondBy ? formatDeadlineDate(row.respondBy) : "",
    decision: row.decision,
    notes: row.notes ?? "",
  };
}
