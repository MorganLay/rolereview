import "server-only";

import type { Plan } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { PLANS, type MeteredKind } from "./plans";

/**
 * Quota from successful AiCall rows, plus bonus credits.
 * docs/04-DATA-MODEL.md → Quotas & bonus credits.
 */

export type QuotaDecision = { allowed: boolean; useBonus: boolean };

export type BonusCreditCandidate = {
  id: string;
  remaining: number;
  expiresAt: Date | null;
  createdAt: Date;
};

/** UTC month, or UTC day for ANALYZE. `end` is exclusive. */
export function periodBounds(
  kind: MeteredKind,
  now: Date,
): { start: Date; end: Date } {
  const period = PLANS.FREE.limits[kind].period;
  if (PLANS.PRO.limits[kind].period !== period) {
    throw new Error(`Quota period mismatch for ${kind}.`);
  }
  if (period === "day") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Under the allowance first. Bonus credits apply only after it is used up. */
export function decideQuota(input: {
  used: number;
  allowance: number;
  bonus: number;
}): QuotaDecision {
  if (input.used < input.allowance) {
    return { allowed: true, useBonus: false };
  }
  if (input.bonus > 0) {
    return { allowed: true, useBonus: true };
  }
  return { allowed: false, useBonus: false };
}

/**
 * Soonest expiry first. No expiry (`expiresAt` null) is last.
 * The same expiry uses the oldest `createdAt`. `expiresAt === now` is already expired.
 */
export function selectBonusCredit<T extends BonusCreditCandidate>(
  credits: readonly T[],
  now: Date,
): T | null {
  const usable = credits.filter(
    (credit) =>
      credit.remaining > 0 &&
      (credit.expiresAt === null || credit.expiresAt > now),
  );
  usable.sort((a, b) => {
    if (a.expiresAt === null && b.expiresAt === null) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    if (a.expiresAt === null) return 1;
    if (b.expiresAt === null) return -1;
    const expiry = a.expiresAt.getTime() - b.expiresAt.getTime();
    if (expiry !== 0) return expiry;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return usable[0] ?? null;
}

export async function checkQuota(
  user: { id: string; plan: Plan },
  kind: MeteredKind,
  now: Date = new Date(),
): Promise<QuotaDecision> {
  const { start, end } = periodBounds(kind, now);
  const used = await db.aiCall.count({
    where: {
      userId: user.id,
      kind,
      success: true,
      usedBonusCredit: false,
      createdAt: { gte: start, lt: end },
    },
  });
  const bonus = await db.bonusCredit.aggregate({
    where: {
      userId: user.id,
      kind,
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { remaining: true },
  });
  return decideQuota({
    used,
    allowance: PLANS[user.plan].limits[kind].allowance,
    bonus: bonus._sum.remaining ?? 0,
  });
}
