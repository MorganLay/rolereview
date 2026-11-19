import type { MeteredKind } from "./plans";

/**
 * How long an in-flight slot counts. The Claude client waits 120s and retries
 * twice, so a live call finishes inside this window. A process that dies
 * keeps the slot until this time, then the next reserve for that person and
 * kind releases it.
 */
export const QUOTA_HOLD_MS = 8 * 60 * 1000;

export function holdDeadline(now: Date): Date {
  return new Date(now.getTime() + QUOTA_HOLD_MS);
}

export type HeldCall = {
  success: boolean;
  usedBonusCredit: boolean;
  heldUntil: Date | null;
  createdAt: Date;
};

/** A slot that still blocks another call. */
export function isOpenHold(row: HeldCall, now: Date): boolean {
  return row.success === false && row.heldUntil !== null && row.heldUntil > now;
}

/** A slot whose time passed before the call settled. The next reserve releases it. */
export function isExpiredHold(row: HeldCall, now: Date): boolean {
  return row.success === false && row.heldUntil !== null && row.heldUntil <= now;
}

/** Plan allowance. Bonus calls and bonus holds stay out of this count. */
export function countsAsPlanUse(row: HeldCall, now: Date): boolean {
  if (row.usedBonusCredit) return false;
  if (row.success) return true;
  return isOpenHold(row, now);
}

/** Daily abuse cap. Successful calls and every open hold count, bonus included. */
export function countsAsDayUse(row: HeldCall, now: Date): boolean {
  if (row.success) return true;
  return isOpenHold(row, now);
}

export function inWindow(createdAt: Date, start: Date, end: Date): boolean {
  return createdAt >= start && createdAt < end;
}

/** Monthly (or period) uses, including an open plan hold. */
export function planUseWhere(
  userId: string,
  kind: MeteredKind,
  start: Date,
  end: Date,
  now: Date,
) {
  return {
    userId,
    kind,
    usedBonusCredit: false as const,
    createdAt: { gte: start, lt: end },
    OR: [
      { success: true as const },
      { success: false as const, heldUntil: { gt: now } },
    ],
  };
}

/** UTC-day uses, including every open hold. */
export function dayUseWhere(
  userId: string,
  kind: MeteredKind,
  start: Date,
  end: Date,
  now: Date,
) {
  return {
    userId,
    kind,
    createdAt: { gte: start, lt: end },
    OR: [
      { success: true as const },
      { success: false as const, heldUntil: { gt: now } },
    ],
  };
}
