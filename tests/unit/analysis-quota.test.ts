import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

type CallRow = {
  id: string;
  userId: string | null;
  refId: string | null;
  kind: string;
  model: string;
  success: boolean;
  usedBonusCredit: boolean;
  errorCode: string | null;
  heldUntil: Date | null;
  createdAt: Date;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  costMicros: number;
};

type CreditRow = {
  id: string;
  userId: string;
  kind: string;
  amount: number;
  remaining: number;
  expiresAt: Date | null;
  createdAt: Date;
};

const calls: CallRow[] = [];
const credits: CreditRow[] = [];
let nextId = 0;

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !(value instanceof Date);
}

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(expected)) {
      const ok = expected.some(
        (branch) => isRecord(branch) && matches(row, branch),
      );
      if (!ok) return false;
      continue;
    }
    const value = row[key];
    if (isRecord(expected)) {
      if ("not" in expected && expected.not === null && (value === null || value === undefined)) {
        return false;
      }
      if ("in" in expected && !((expected.in as unknown[]).includes(value))) return false;
      if ("gt" in expected) {
        const above =
          value instanceof Date && expected.gt instanceof Date
            ? value > expected.gt
            : typeof value === "number" && typeof expected.gt === "number" && value > expected.gt;
        if (!above) return false;
      }
      if ("gte" in expected) {
        if (!(value instanceof Date && expected.gte instanceof Date && value >= expected.gte)) {
          return false;
        }
      }
      if ("lt" in expected) {
        if (!(value instanceof Date && expected.lt instanceof Date && value < expected.lt)) {
          return false;
        }
      }
      if ("lte" in expected) {
        if (!(value instanceof Date && expected.lte instanceof Date && value <= expected.lte)) {
          return false;
        }
      }
      continue;
    }
    if (value !== expected) return false;
  }
  return true;
}

function applyData(row: Record<string, unknown>, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (isRecord(value) && "increment" in value && typeof row[key] === "number") {
      row[key] = (row[key] as number) + (value.increment as number);
      continue;
    }
    if (isRecord(value) && "decrement" in value && typeof row[key] === "number") {
      row[key] = (row[key] as number) - (value.decrement as number);
      continue;
    }
    row[key] = value;
  }
}

vi.mock("@/lib/ai/client", () => ({
  getAnthropic: () => ({ messages: { create } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    aiCall: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        calls.filter((row) => matches(row as unknown as Record<string, unknown>, where)).length,
    },
    bonusCredit: {
      aggregate: async () => ({
        _sum: {
          remaining: credits.reduce((sum, credit) => sum + credit.remaining, 0) || null,
        },
      }),
    },
    $transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        $executeRaw: async () => 0,
        user: {
          findFirst: async () => ({ plan: "FREE" as const }),
        },
        aiCall: {
          create: async ({ data }: { data: Partial<CallRow> & Pick<CallRow, "kind" | "success"> }) => {
            const row: CallRow = {
              id: data.id ?? `call-${nextId++}`,
              userId: data.userId ?? null,
              refId: data.refId ?? null,
              kind: data.kind,
              model: data.model ?? "",
              success: data.success,
              usedBonusCredit: data.usedBonusCredit ?? false,
              errorCode: data.errorCode ?? null,
              heldUntil: data.heldUntil ?? null,
              createdAt: data.createdAt ?? NOW,
              inputTokens: data.inputTokens ?? 0,
              outputTokens: data.outputTokens ?? 0,
              cacheReadTokens: data.cacheReadTokens ?? 0,
              cacheWriteTokens: data.cacheWriteTokens ?? 0,
              durationMs: data.durationMs ?? 0,
              costMicros: data.costMicros ?? 0,
            };
            calls.push(row);
            return row;
          },
          findMany: async ({ where }: { where: Record<string, unknown> }) =>
            calls.filter((row) => matches(row as unknown as Record<string, unknown>, where)),
          updateMany: async ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }) => {
            const matched = calls.filter((row) =>
              matches(row as unknown as Record<string, unknown>, where),
            );
            for (const row of matched) applyData(row as unknown as Record<string, unknown>, data);
            return { count: matched.length };
          },
        },
        bonusCredit: {
          findMany: async ({ where }: { where: Record<string, unknown> }) =>
            credits.filter((row) => matches(row as unknown as Record<string, unknown>, where)),
          updateMany: async ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }) => {
            const matched = credits.filter((row) =>
              matches(row as unknown as Record<string, unknown>, where),
            );
            for (const row of matched) applyData(row as unknown as Record<string, unknown>, data);
            return { count: matched.length };
          },
        },
      }),
  },
}));

import { releaseUnsavedAnalysis } from "@/features/billing/quota";
import { quotaSnapshot } from "@/features/billing/quota";
import { runStructured } from "@/lib/ai/run";

const NOW = new Date("2026-10-27T15:00:00.000Z");
const schema = z.object({ title: z.string() });

const baseArgs = {
  kind: "ANALYZE" as const,
  userId: "user-1",
  system: "Extract the job title.",
  content: [{ type: "text" as const, text: "<posting>Office assistant.</posting>" }],
  schema,
  refId: "job-1",
  now: NOW,
};

function message() {
  return {
    stop_reason: "end_turn",
    content: [{ type: "text" as const, text: JSON.stringify({ title: "Analyst" }) }],
    usage: {
      input_tokens: 100,
      output_tokens: 20,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_creation: null,
    },
  };
}

async function usedToday(): Promise<number> {
  const snapshot = await quotaSnapshot({ id: "user-1", plan: "FREE" }, "ANALYZE", NOW);
  return snapshot.used;
}

describe("analysis quota", () => {
  beforeEach(() => {
    calls.length = 0;
    credits.length = 0;
    nextId = 0;
    create.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("counts two successful analyses as 2 used and one failure as no extra use", async () => {
    create.mockResolvedValueOnce(message());
    create.mockResolvedValueOnce(message());
    create.mockRejectedValueOnce(new Error("overloaded"));

    await runStructured(baseArgs);
    await runStructured({ ...baseArgs, refId: "job-2" });
    const failed = await runStructured({ ...baseArgs, refId: "job-3" });

    expect(failed).toEqual({ ok: false, code: "AI_FAILED" });
    expect(await usedToday()).toBe(2);
    expect(calls.filter((row) => row.success)).toHaveLength(2);
    expect(calls.filter((row) => !row.success)).toHaveLength(1);
  });

  it("drops a saved-looking charge when the analysis is released, then counts the retry once", async () => {
    create.mockResolvedValue(message());
    await runStructured({ ...baseArgs, refId: "job-9" });
    expect(await usedToday()).toBe(1);

    await releaseUnsavedAnalysis("user-1", "job-9");
    expect(await usedToday()).toBe(0);

    await runStructured({ ...baseArgs, refId: "job-9" });
    expect(await usedToday()).toBe(1);
    expect(calls.filter((row) => row.success)).toHaveLength(1);
  });

  it("restores a bonus credit when the unsaved analysis had spent one", async () => {
    const earlier = new Date("2026-10-01T12:00:00.000Z");
    for (let index = 0; index < 30; index += 1) {
      calls.push({
        id: `seed-${index}`,
        userId: "user-1",
        refId: `old-${index}`,
        kind: "ANALYZE",
        model: "claude-haiku-5-5",
        success: true,
        usedBonusCredit: false,
        errorCode: null,
        heldUntil: null,
        createdAt: earlier,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        durationMs: 0,
        costMicros: 0,
      });
    }
    credits.push({
      id: "credit-1",
      userId: "user-1",
      kind: "ANALYZE",
      amount: 1,
      remaining: 1,
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    create.mockResolvedValue(message());
    await runStructured({ ...baseArgs, refId: "job-4" });
    expect(credits[0]?.remaining).toBe(0);
    expect(await usedToday()).toBe(30);

    await releaseUnsavedAnalysis("user-1", "job-4");
    expect(credits[0]?.remaining).toBe(1);
    expect(await usedToday()).toBe(30);
    const snapshot = await quotaSnapshot({ id: "user-1", plan: "FREE" }, "ANALYZE", NOW);
    expect(snapshot.remaining).toBe(1);
  });
});
