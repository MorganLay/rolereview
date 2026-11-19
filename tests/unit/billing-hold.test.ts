import { describe, expect, it } from "vitest";

import {
  countsAsDayUse,
  countsAsPlanUse,
  isExpiredHold,
  isOpenHold,
} from "@/features/billing/hold-rules";
import {
  reserveMeteredSlot,
  settleMeteredSlot,
  takeLimitedSlot,
  type SlotStore,
} from "@/features/billing/hold";
import type { MeteredKind } from "@/features/billing/plans";

const NOW = new Date("2026-10-19T15:04:00.000Z");

type MemoryCall = {
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

type MemoryCredit = {
  id: string;
  remaining: number;
  amount: number;
  expiresAt: Date | null;
  createdAt: Date;
};

function memoryStore() {
  const calls: MemoryCall[] = [];
  const credits: MemoryCredit[] = [];
  let locked = false;
  const waiters: Array<() => void> = [];
  const store: SlotStore = {
    async lockUser() {
      while (locked) {
        await new Promise<void>((resolve) => waiters.push(resolve));
      }
      locked = true;
      return () => {
        locked = false;
        waiters.shift()?.();
      };
    },
    async loadPlan() {
      return "FREE";
    },
    async loadCalls(userId, kind, monthStart) {
      return calls.filter(
        (row) =>
          row.userId === userId &&
          row.kind === kind &&
          (row.createdAt >= monthStart || (row.success === false && row.heldUntil !== null)),
      );
    },
    async loadCredits() {
      return credits;
    },
    async insertCall(row) {
      calls.push(row);
    },
    async updateCall(row) {
      const index = calls.findIndex((call) => call.id === row.id);
      if (index >= 0) calls[index] = row;
    },
    async updateCredit(row) {
      const index = credits.findIndex((credit) => credit.id === row.id);
      if (index >= 0) credits[index] = row;
    },
  };
  return { store, calls, credits };
}

function blankCall(partial: Partial<MemoryCall> & Pick<MemoryCall, "id" | "kind">): MemoryCall {
  return {
    userId: "user-1",
    model: "test",
    success: true,
    errorCode: null,
    usedBonusCredit: false,
    heldUntil: null,
    refId: null,
    createdAt: NOW,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    durationMs: 0,
    costMicros: 0,
    ...partial,
  };
}

const reserveInput = {
  userId: "user-1",
  kind: "COVER_LETTER" as const,
  model: "test",
  now: NOW,
};

describe("hold rules", () => {
  it("counts an open plan hold and ignores an expired one", () => {
    const open = {
      success: false,
      usedBonusCredit: false,
      heldUntil: new Date(NOW.getTime() + 1000),
      createdAt: NOW,
    };
    expect(isOpenHold(open, NOW)).toBe(true);
    expect(countsAsPlanUse(open, NOW)).toBe(true);
    expect(countsAsDayUse(open, NOW)).toBe(true);

    const expired = { ...open, heldUntil: new Date(NOW.getTime() - 1) };
    expect(isExpiredHold(expired, NOW)).toBe(true);
    expect(countsAsPlanUse(expired, NOW)).toBe(false);
    expect(countsAsDayUse(expired, NOW)).toBe(false);

    const bonus = { ...open, usedBonusCredit: true };
    expect(countsAsPlanUse(bonus, NOW)).toBe(false);
    expect(countsAsDayUse(bonus, NOW)).toBe(true);
  });
});

describe("reserveMeteredSlot", () => {
  it("lets one of two overlapping cover letters take the single free slot", async () => {
    const { store, calls } = memoryStore();
    const [first, second] = await Promise.all([
      reserveMeteredSlot(store, reserveInput),
      reserveMeteredSlot(store, reserveInput),
    ]);
    expect([first, second].filter((row) => row.ok)).toHaveLength(1);
    expect(calls.filter((row) => row.heldUntil !== null)).toHaveLength(1);
  });

  it("releases an expired bonus hold before counting, then allows the plan slot", async () => {
    const { store, calls, credits } = memoryStore();
    calls.push(
      blankCall({
        id: "expired",
        kind: "COVER_LETTER",
        success: false,
        usedBonusCredit: true,
        heldUntil: new Date(NOW.getTime() - 1000),
      }),
    );
    credits.push({
      id: "credit-1",
      remaining: 0,
      amount: 1,
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const reserved = await reserveMeteredSlot(store, reserveInput);

    expect(reserved.ok).toBe(true);
    if (reserved.ok) expect(reserved.useBonus).toBe(false);
    expect(calls.find((row) => row.id === "expired")).toMatchObject({
      errorCode: "EXPIRED",
      heldUntil: null,
      usedBonusCredit: false,
    });
    expect(credits[0]?.remaining).toBe(1);
  });

  it("blocks a job analysis when open holds fill the daily cap", async () => {
    const { store, calls } = memoryStore();
    for (let index = 0; index < 9; index += 1) {
      calls.push(blankCall({ id: `done-${index}`, kind: "ANALYZE" }));
    }
    calls.push(
      blankCall({
        id: "open",
        kind: "ANALYZE",
        success: false,
        heldUntil: new Date(NOW.getTime() + 60_000),
      }),
    );

    const reserved = await reserveMeteredSlot(store, {
      ...reserveInput,
      kind: "ANALYZE",
    });

    expect(reserved).toEqual({ ok: false, limit: "day" });
  });

  it("spends one bonus credit when two requests overlap past the allowance", async () => {
    const { store, calls, credits } = memoryStore();
    calls.push(blankCall({ id: "used", kind: "COVER_LETTER" }));
    credits.push({
      id: "credit-1",
      remaining: 1,
      amount: 1,
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const [first, second] = await Promise.all([
      reserveMeteredSlot(store, reserveInput),
      reserveMeteredSlot(store, reserveInput),
    ]);
    const won = [first, second].filter((row) => row.ok);

    expect(won).toHaveLength(1);
    expect(won[0]).toMatchObject({ ok: true, useBonus: true });
    expect(credits[0]?.remaining).toBe(0);
  });

  it("gives the bonus credit back when the call fails", async () => {
    const { store, calls, credits } = memoryStore();
    calls.push(blankCall({ id: "used", kind: "COVER_LETTER" }));
    credits.push({
      id: "credit-1",
      remaining: 1,
      amount: 1,
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const reserved = await reserveMeteredSlot(store, reserveInput);
    expect(reserved.ok).toBe(true);
    if (!reserved.ok) return;

    await settleMeteredSlot(store, {
      id: reserved.id,
      userId: "user-1",
      kind: "COVER_LETTER",
      success: false,
      errorCode: "AI_FAILED",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      durationMs: 0,
      costMicros: 0,
      now: NOW,
    });

    expect(credits[0]?.remaining).toBe(1);
    expect(calls.find((row) => row.id === reserved.id)).toMatchObject({
      success: false,
      heldUntil: null,
      usedBonusCredit: false,
    });
  });

  it("leaves a hold alone once its time has passed", async () => {
    const { store, calls, credits } = memoryStore();
    calls.push(
      blankCall({
        id: "late",
        kind: "COVER_LETTER",
        success: false,
        usedBonusCredit: true,
        heldUntil: new Date(NOW.getTime() - 1000),
      }),
    );
    credits.push({
      id: "credit-1",
      remaining: 0,
      amount: 1,
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await settleMeteredSlot(store, {
      id: "late",
      userId: "user-1",
      kind: "COVER_LETTER",
      success: true,
      errorCode: null,
      inputTokens: 10,
      outputTokens: 2,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      durationMs: 1,
      costMicros: 1,
      now: NOW,
    });

    expect(calls[0]).toMatchObject({ success: false, usedBonusCredit: true });
    expect(credits[0]?.remaining).toBe(0);
  });
});

describe("takeLimitedSlot", () => {
  it("keeps a fourth overlapping attempt out when the limit is three", async () => {
    let used = 0;
    let locked = false;
    const waiters: Array<() => void> = [];
    const results = await Promise.all(
      [0, 1, 2, 3].map(() =>
        takeLimitedSlot(
          async () => {
            while (locked) {
              await new Promise<void>((resolve) => waiters.push(resolve));
            }
            locked = true;
            return () => {
              locked = false;
              waiters.shift()?.();
            };
          },
          async () => used,
          async () => {
            used += 1;
            return `run-${used}`;
          },
          3,
        ),
      ),
    );
    expect(results.filter((row) => row.ok)).toHaveLength(3);
    expect(used).toBe(3);
  });
});

describe.skipIf(process.env.QUOTA_DB !== "1")("metered slot against Postgres", () => {
  it("serializes two cover letters, then accepts another after failure and after expiry", async () => {
    const { randomUUID } = await import("node:crypto");
    const { db } = await import("@/lib/db");
    const { reserveMeteredCall, settleMeteredCall } = await import("@/features/billing/hold");
    const id = randomUUID();
    await db.user.create({
      data: {
        id,
        email: `quota-${id}@example.com`,
        referralCode: id.replaceAll("-", "").slice(0, 8),
      },
    });
    const failed = {
      userId: id,
      kind: "COVER_LETTER" as const,
      success: false,
      errorCode: "AI_FAILED",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      durationMs: 0,
      costMicros: 0,
    };
    try {
      const now = new Date();
      const [first, second] = await Promise.all([
        reserveMeteredCall({ userId: id, kind: "COVER_LETTER", model: "test", now }),
        reserveMeteredCall({ userId: id, kind: "COVER_LETTER", model: "test", now }),
      ]);
      const won = [first, second].filter((row) => row.ok);
      expect(won).toHaveLength(1);
      const held = won[0];
      if (!held?.ok) throw new Error("missing hold");
      await settleMeteredCall({ ...failed, id: held.id, now });

      const again = await reserveMeteredCall({
        userId: id,
        kind: "COVER_LETTER",
        model: "test",
        now,
      });
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      await db.aiCall.updateMany({
        where: { id: again.id, userId: id },
        data: { heldUntil: new Date(now.getTime() - 1000), success: false },
      });
      const later = new Date(now.getTime() + 60_000);
      const afterExpiry = await reserveMeteredCall({
        userId: id,
        kind: "COVER_LETTER",
        model: "test",
        now: later,
      });
      expect(afterExpiry.ok).toBe(true);
      const expired = await db.aiCall.findFirst({
        where: { id: again.id, userId: id },
        select: { errorCode: true, heldUntil: true },
      });
      expect(expired).toEqual({ errorCode: "EXPIRED", heldUntil: null });
    } finally {
      await db.user.deleteMany({ where: { id } });
    }
  });
});
