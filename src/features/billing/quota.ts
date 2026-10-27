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

/** Plan uses still left this period, plus unused bonus credits. */
export function quotaRemaining(input: {
  used: number;
  allowance: number;
  bonus: number;
}): number {
  const planLeft = Math.max(0, input.allowance - input.used);
  return planLeft + Math.max(0, input.bonus);
}

export type QuotaSnapshot = {
  used: number;
  allowance: number;
  bonus: number;
  remaining: number;
};

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
  usable.sort(compareBonusCredits);
  return usable[0] ?? null;
}

function compareBonusCredits(a: BonusCreditCandidate, b: BonusCreditCandidate): number {
  if (a.expiresAt === null && b.expiresAt === null) {
    return a.createdAt.getTime() - b.createdAt.getTime();
  }
  if (a.expiresAt === null) return 1;
  if (b.expiresAt === null) return -1;
  const expiry = a.expiresAt.getTime() - b.expiresAt.getTime();
  if (expiry !== 0) return expiry;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

async function loadQuotaCounts(
  user: { id: string; plan: Plan },
  kind: MeteredKind,
  now: Date,
): Promise<{ used: number; allowance: number; bonus: number }> {
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
  return {
    used,
    allowance: PLANS[user.plan].limits[kind].allowance,
    bonus: bonus._sum.remaining ?? 0,
  };
}

export async function checkQuota(
  user: { id: string; plan: Plan },
  kind: MeteredKind,
  now: Date = new Date(),
): Promise<QuotaDecision> {
  return decideQuota(await loadQuotaCounts(user, kind, now));
}

/** Used, allowance, bonus, and how many calls are left. Same counts as `checkQuota`. */
export async function quotaSnapshot(
  user: { id: string; plan: Plan },
  kind: MeteredKind,
  now: Date = new Date(),
): Promise<QuotaSnapshot> {
  const counts = await loadQuotaCounts(user, kind, now);
  return { ...counts, remaining: quotaRemaining(counts) };
}

/**
 * A model success is recorded before the analysis is saved. If that save does
 * not stick, drop the charge so a retry is not a second use. Restores a bonus
 * credit when the row spent one.
 */
export async function releaseUnsavedAnalysis(userId: string, refId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const rows = await tx.aiCall.findMany({
      where: { userId, refId, kind: "ANALYZE", success: true },
      select: { id: true, usedBonusCredit: true },
    });
    if (rows.length === 0) return;
    await tx.aiCall.updateMany({
      where: { userId, id: { in: rows.map((row) => row.id) } },
      data: { success: false, errorCode: "AI_FAILED" },
    });
    let restore = rows.filter((row) => row.usedBonusCredit).length;
    if (restore === 0) return;
    const credits = await tx.bonusCredit.findMany({
      where: { userId, kind: "ANALYZE" },
      select: {
        id: true,
        remaining: true,
        amount: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    const ordered = credits
      .filter((credit) => credit.remaining < credit.amount)
      .sort(compareBonusCredits);
    for (const credit of ordered) {
      if (restore === 0) break;
      const give = Math.min(credit.amount - credit.remaining, restore);
      const updated = await tx.bonusCredit.updateMany({
        where: { id: credit.id, userId, remaining: credit.remaining },
        data: { remaining: { increment: give } },
      });
      if (updated.count === 1) restore -= give;
    }
  });
}
