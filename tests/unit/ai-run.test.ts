import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { parse, aiCallCreate, bonusFindMany, bonusUpdateMany } = vi.hoisted(() => ({
  parse: vi.fn(),
  aiCallCreate: vi.fn(),
  bonusFindMany: vi.fn(),
  bonusUpdateMany: vi.fn(),
}));

vi.mock("@/lib/ai/client", () => ({
  getAnthropic: () => ({ messages: { parse } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        aiCall: { create: aiCallCreate },
        bonusCredit: { findMany: bonusFindMany, updateMany: bonusUpdateMany },
      }),
  },
}));

import { runStructured } from "@/lib/ai/run";

const schema = z.object({ title: z.string() });

const baseArgs = {
  kind: "ANALYZE" as const,
  userId: "user-1",
  system: "Extract the job title.",
  content: [{ type: "text" as const, text: "<posting>Office assistant.</posting>" }],
  schema,
  refId: "job-1",
};

function message(partial: {
  stop_reason: string | null;
  parsed_output: unknown;
  input_tokens?: number;
  output_tokens?: number;
}) {
  return {
    stop_reason: partial.stop_reason,
    parsed_output: partial.parsed_output,
    usage: {
      input_tokens: partial.input_tokens ?? 100,
      output_tokens: partial.output_tokens ?? 20,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_creation: null,
    },
  };
}

describe("runStructured", () => {
  beforeEach(() => {
    parse.mockReset();
    aiCallCreate.mockReset();
    bonusFindMany.mockReset();
    bonusUpdateMany.mockReset();
    aiCallCreate.mockResolvedValue({ id: "call-1" });
    bonusFindMany.mockResolvedValue([]);
    bonusUpdateMany.mockResolvedValue({ count: 0 });
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed data and logs a successful call without a bonus credit", async () => {
    parse.mockResolvedValue(
      message({ stop_reason: "end_turn", parsed_output: { title: "Analyst" } }),
    );

    const result = await runStructured(baseArgs);

    expect(result).toEqual({ ok: true, data: { title: "Analyst" } });
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-5-5",
        max_tokens: 4000,
        system: baseArgs.system,
        output_config: expect.objectContaining({ effort: "low" }),
      }),
    );
    expect(bonusFindMany).not.toHaveBeenCalled();
    expect(aiCallCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        kind: "ANALYZE",
        model: "claude-haiku-5-5",
        success: true,
        errorCode: null,
        inputTokens: 100,
        outputTokens: 20,
        refId: "job-1",
        usedBonusCredit: false,
        costMicros: 20,
      }),
    });
    const logged = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logged).not.toContain("Office assistant");
    expect(logged).not.toContain("Analyst");
  });

  it("maps refusal and does not spend a bonus credit", async () => {
    parse.mockResolvedValue(
      message({ stop_reason: "refusal", parsed_output: null, input_tokens: 50, output_tokens: 10 }),
    );

    const result = await runStructured({ ...baseArgs, usedBonusCredit: true });

    expect(result).toEqual({ ok: false, code: "AI_REFUSED" });
    expect(bonusUpdateMany).not.toHaveBeenCalled();
    expect(aiCallCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        success: false,
        errorCode: "AI_REFUSED",
        inputTokens: 50,
        outputTokens: 10,
        usedBonusCredit: false,
      }),
    });
  });

  it("maps max_tokens to AI_TRUNCATED", async () => {
    parse.mockResolvedValue(
      message({ stop_reason: "max_tokens", parsed_output: { title: "Partial" } }),
    );

    const result = await runStructured(baseArgs);

    expect(result).toEqual({ ok: false, code: "AI_TRUNCATED" });
    expect(aiCallCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ success: false, errorCode: "AI_TRUNCATED" }),
    });
  });

  it("maps a thrown SDK error and a null parse to AI_FAILED", async () => {
    parse.mockRejectedValue(new Error("overloaded"));
    const thrown = await runStructured(baseArgs);
    expect(thrown).toEqual({ ok: false, code: "AI_FAILED" });
    expect(aiCallCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        success: false,
        errorCode: "AI_FAILED",
        inputTokens: 0,
        outputTokens: 0,
        costMicros: 0,
        usedBonusCredit: false,
      }),
    });

    parse.mockResolvedValue(message({ stop_reason: "end_turn", parsed_output: null }));
    const empty = await runStructured(baseArgs);
    expect(empty).toEqual({ ok: false, code: "AI_FAILED" });

    parse.mockResolvedValue(message({ stop_reason: "end_turn", parsed_output: { title: 4 } }));
    const invalid = await runStructured(baseArgs);
    expect(invalid).toEqual({ ok: false, code: "AI_FAILED" });
  });

  it("decrements the chosen bonus credit on success", async () => {
    parse.mockResolvedValue(
      message({ stop_reason: "end_turn", parsed_output: { title: "Analyst" } }),
    );
    bonusFindMany.mockResolvedValue([
      {
        id: "credit-1",
        remaining: 2,
        expiresAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    bonusUpdateMany.mockResolvedValue({ count: 1 });

    const result = await runStructured({ ...baseArgs, usedBonusCredit: true });

    expect(result.ok).toBe(true);
    expect(bonusUpdateMany).toHaveBeenCalledWith({
      where: { id: "credit-1", userId: "user-1", remaining: { gt: 0 } },
      data: { remaining: { decrement: 1 } },
    });
    expect(aiCallCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ success: true, usedBonusCredit: true }),
    });
  });

  it("still marks usedBonusCredit when the credit row is already gone", async () => {
    parse.mockResolvedValue(
      message({ stop_reason: "end_turn", parsed_output: { title: "Analyst" } }),
    );
    bonusFindMany.mockResolvedValue([]);

    await runStructured({ ...baseArgs, usedBonusCredit: true });

    expect(bonusUpdateMany).not.toHaveBeenCalled();
    expect(aiCallCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ success: true, usedBonusCredit: true }),
    });
  });

  it("allows an anonymous FREE_TOOL call", async () => {
    parse.mockResolvedValue(
      message({ stop_reason: "end_turn", parsed_output: { title: "Analyst" } }),
    );

    const result = await runStructured({
      ...baseArgs,
      kind: "FREE_TOOL",
      userId: null,
      refId: undefined,
    });

    expect(result.ok).toBe(true);
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-5-5", max_tokens: 4000 }),
    );
    expect(aiCallCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        kind: "FREE_TOOL",
        refId: null,
        usedBonusCredit: false,
      }),
    });
  });

  it("rejects a signed-in call with no user and a named FREE_TOOL call", async () => {
    await expect(runStructured({ ...baseArgs, userId: null })).rejects.toThrow(
      /FREE_TOOL/,
    );
    await expect(
      runStructured({ ...baseArgs, kind: "FREE_TOOL", userId: "user-1" }),
    ).rejects.toThrow(/anonymous/);
    expect(parse).not.toHaveBeenCalled();
  });
});
