import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { Plan } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import {
  countsAsDayUse,
  countsAsPlanUse,
  holdDeadline,
  inWindow,
  isExpiredHold,
  isOpenHold,
} from "./hold-rules";
import { limitDailyCap, PLANS, type MeteredKind } from "./plans";
import {
  dailyCapBlocks,
  decideQuota,
  periodBounds,
  planBonusRestore,
  selectBonusCredit,
  utcDayBounds,
  type BonusCreditCandidate,
} from "./quota";

export type HeldSlot = { ok: true; id: string; useBonus: boolean } | { ok: false; limit?: "day" };

type SlotCall = {
  id: string;
  userId: string;
  kind: MeteredKind;
  model: string;
  success: boolean;
  errorCode: string | null;
  usedBonusCredit: boolean;
  heldUntil: Date | null;
  refId: string | null;
  createdAt: Date;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  costMicros: number;
};

type SlotCredit = BonusCreditCandidate & { amount: number };

/**
 * The lock is held for the whole reserve. Production uses a row lock that
 * ends when the transaction commits. The returned function releases a test mutex.
 */
export type SlotStore = {
  lockUser(userId: string): Promise<() => void>;
  loadPlan(userId: string): Promise<Plan | null>;
  loadCalls(userId: string, kind: MeteredKind, monthStart: Date): Promise<SlotCall[]>;
  loadCredits(userId: string, kind: MeteredKind): Promise<SlotCredit[]>;
  insertCall(row: SlotCall): Promise<void>;
  updateCall(row: SlotCall): Promise<void>;
  updateCredit(row: SlotCredit): Promise<void>;
};

export type SettleInput = {
  id: string;
  userId: string;
  kind: MeteredKind;
  success: boolean;
  errorCode: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  costMicros: number;
};

/**
 * Take one allowance slot under the user lock. Open holds count. An expired
 * hold is released here, and its bonus credit is put back, before the count.
 */
export async function reserveMeteredSlot(
  store: SlotStore,
  input: {
    userId: string;
    kind: MeteredKind;
    model: string;
    refId?: string;
    now: Date;
  },
): Promise<HeldSlot> {
  const unlock = await store.lockUser(input.userId);
  try {
    const plan = await store.loadPlan(input.userId);
    if (!plan) return { ok: false };
    const { start, end } = periodBounds(input.kind, input.now);
    const calls = await store.loadCalls(input.userId, input.kind, start);
    let credits = await store.loadCredits(input.userId, input.kind);
    const expired = calls.filter((row) => isExpiredHold(row, input.now));
    const giveBack = expired.filter((row) => row.usedBonusCredit).length;
    for (const row of expired) {
      await store.updateCall({
        ...row,
        heldUntil: null,
        usedBonusCredit: false,
        errorCode: "EXPIRED",
      });
    }
    if (giveBack > 0) {
      credits = applyRestore(credits, giveBack);
      for (const credit of credits) await store.updateCredit(credit);
    }

    const day = utcDayBounds(input.now);
    const planUses = calls.filter(
      (row) =>
        !expired.includes(row) &&
        inWindow(row.createdAt, start, end) &&
        countsAsPlanUse(row, input.now),
    ).length;
    const dayUses = calls.filter(
      (row) =>
        !expired.includes(row) &&
        inWindow(row.createdAt, day.start, day.end) &&
        countsAsDayUse(row, input.now),
    ).length;
    const cap = limitDailyCap(PLANS[plan].limits[input.kind]);
    if (dailyCapBlocks(dayUses, cap)) return { ok: false, limit: "day" };

    const bonus = credits
      .filter(
        (credit) =>
          credit.remaining > 0 &&
          (credit.expiresAt === null || credit.expiresAt > input.now),
      )
      .reduce((sum, credit) => sum + credit.remaining, 0);
    const decision = decideQuota({
      used: planUses,
      allowance: PLANS[plan].limits[input.kind].allowance,
      bonus,
    });
    if (!decision.allowed) return { ok: false };

    let useBonus = false;
    if (decision.useBonus) {
      const picked = selectBonusCredit(credits, input.now);
      if (!picked) return { ok: false };
      const next = credits.map((credit) =>
        credit.id === picked.id ? { ...credit, remaining: credit.remaining - 1 } : credit,
      );
      const spent = next.find((credit) => credit.id === picked.id);
      if (!spent) return { ok: false };
      await store.updateCredit(spent);
      useBonus = true;
    }

    const row: SlotCall = {
      id: randomUUID(),
      userId: input.userId,
      kind: input.kind,
      model: input.model,
      success: false,
      errorCode: null,
      usedBonusCredit: useBonus,
      heldUntil: holdDeadline(input.now),
      refId: input.refId ?? null,
      createdAt: input.now,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      durationMs: 0,
      costMicros: 0,
    };
    await store.insertCall(row);
    return { ok: true, id: row.id, useBonus };
  } finally {
    unlock();
  }
}

function applyRestore(credits: SlotCredit[], count: number): SlotCredit[] {
  const updates = new Map(planBonusRestore(credits, count).map((update) => [update.id, update.remaining]));
  return credits.map((credit) => {
    const remaining = updates.get(credit.id);
    return remaining === undefined ? credit : { ...credit, remaining };
  });
}

/**
 * Finish or drop the slot. A hold another reserve already released is left
 * alone, so a late success cannot charge a slot that was given back, and a
 * bonus credit is not restored twice.
 */
export async function settleMeteredSlot(store: SlotStore, input: SettleInput & { now: Date }): Promise<void> {
  const unlock = await store.lockUser(input.userId);
  try {
    const { start } = periodBounds(input.kind, input.now);
    const calls = await store.loadCalls(input.userId, input.kind, start);
    const row = calls.find((call) => call.id === input.id && isOpenHold(call, input.now));
    if (!row) return;
    await store.updateCall({
      ...row,
      success: input.success,
      heldUntil: null,
      errorCode: input.success ? null : input.errorCode,
      usedBonusCredit: input.success ? row.usedBonusCredit : false,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cacheReadTokens: input.cacheReadTokens,
      cacheWriteTokens: input.cacheWriteTokens,
      durationMs: input.durationMs,
      costMicros: input.costMicros,
    });
    if (!input.success && row.usedBonusCredit) {
      const credits = applyRestore(await store.loadCredits(input.userId, input.kind), 1);
      for (const credit of credits) await store.updateCredit(credit);
    }
  } finally {
    unlock();
  }
}

/** One slot. The lock is held across the count and the insert. */
export async function takeLimitedSlot(
  lock: () => Promise<() => void>,
  count: () => Promise<number>,
  insert: () => Promise<string>,
  limit: number,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const unlock = await lock();
  try {
    const used = await count();
    if (used >= limit) return { ok: false };
    const id = await insert();
    return { ok: true, id };
  } finally {
    unlock();
  }
}

function prismaStore(tx: Prisma.TransactionClient): SlotStore {
  return {
    async lockUser(userId) {
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = CAST(${userId} AS uuid) FOR UPDATE`;
      return () => {};
    },
    async loadPlan(userId) {
      const user = await tx.user.findFirst({
        where: { id: userId },
        select: { plan: true },
      });
      return user?.plan ?? null;
    },
    async loadCalls(userId, kind, monthStart) {
      const rows = await tx.aiCall.findMany({
        where: {
          userId,
          kind,
          OR: [{ createdAt: { gte: monthStart } }, { success: false, heldUntil: { not: null } }],
        },
        select: {
          id: true,
          userId: true,
          kind: true,
          model: true,
          success: true,
          errorCode: true,
          usedBonusCredit: true,
          heldUntil: true,
          refId: true,
          createdAt: true,
          inputTokens: true,
          outputTokens: true,
          cacheReadTokens: true,
          cacheWriteTokens: true,
          durationMs: true,
          costMicros: true,
        },
      });
      return rows.flatMap((row) => {
        if (!row.userId) return [];
        if (!isMeteredKind(row.kind)) return [];
        return [{ ...row, userId: row.userId, kind: row.kind }];
      });
    },
    async loadCredits(userId, kind) {
      return tx.bonusCredit.findMany({
        where: { userId, kind },
        select: {
          id: true,
          remaining: true,
          amount: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    },
    async insertCall(row) {
      await tx.aiCall.create({
        data: {
          id: row.id,
          userId: row.userId,
          kind: row.kind,
          model: row.model,
          success: row.success,
          errorCode: row.errorCode,
          usedBonusCredit: row.usedBonusCredit,
          heldUntil: row.heldUntil,
          refId: row.refId,
          createdAt: row.createdAt,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          cacheReadTokens: row.cacheReadTokens,
          cacheWriteTokens: row.cacheWriteTokens,
          durationMs: row.durationMs,
          costMicros: row.costMicros,
        },
      });
    },
    async updateCall(row) {
      await tx.aiCall.updateMany({
        where: { id: row.id, userId: row.userId },
        data: {
          success: row.success,
          errorCode: row.errorCode,
          usedBonusCredit: row.usedBonusCredit,
          heldUntil: row.heldUntil,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          cacheReadTokens: row.cacheReadTokens,
          cacheWriteTokens: row.cacheWriteTokens,
          durationMs: row.durationMs,
          costMicros: row.costMicros,
        },
      });
    },
    async updateCredit(row) {
      await tx.bonusCredit.updateMany({
        where: { id: row.id },
        data: { remaining: row.remaining },
      });
    },
  };
}

function isMeteredKind(kind: string): kind is MeteredKind {
  return (PLANS.FREE.limits as Record<string, unknown>)[kind] !== undefined;
}

export async function reserveMeteredCall(input: {
  userId: string;
  kind: MeteredKind;
  model: string;
  refId?: string;
  now?: Date;
}): Promise<HeldSlot> {
  const now = input.now ?? new Date();
  return db.$transaction((tx) =>
    reserveMeteredSlot(prismaStore(tx), { ...input, now }),
  );
}

export async function settleMeteredCall(input: SettleInput & { now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await db.$transaction((tx) => settleMeteredSlot(prismaStore(tx), { ...input, now }));
}
