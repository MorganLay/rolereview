import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { create, aiCallCreate, reserveMeteredCall, settleMeteredCall } = vi.hoisted(() => ({
  create: vi.fn(),
  aiCallCreate: vi.fn(),
  reserveMeteredCall: vi.fn(),
  settleMeteredCall: vi.fn(),
}));

vi.mock("@/lib/ai/client", () => ({
  getAnthropic: () => ({ messages: { create } }),
}));

vi.mock("@/features/billing/hold", () => ({
  reserveMeteredCall,
  settleMeteredCall,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        aiCall: { create: aiCallCreate },
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
  parsed_output?: unknown;
  text?: string;
  input_tokens?: number;
  output_tokens?: number;
}) {
  const text =
    partial.text ??
    (partial.parsed_output === undefined ? "" : JSON.stringify(partial.parsed_output));
  return {
    stop_reason: partial.stop_reason,
    content: [{ type: "text" as const, text }],
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
    create.mockReset();
    aiCallCreate.mockReset();
    reserveMeteredCall.mockReset();
    settleMeteredCall.mockReset();
    aiCallCreate.mockResolvedValue({ id: "call-1" });
    reserveMeteredCall.mockResolvedValue({ ok: true, id: "hold-1", useBonus: false });
    settleMeteredCall.mockResolvedValue(undefined);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed data and logs a successful call without a bonus credit", async () => {
    create.mockResolvedValue(
      message({ stop_reason: "end_turn", parsed_output: { title: "Analyst" } }),
    );

    const result = await runStructured(baseArgs);

    expect(result).toEqual({ ok: true, data: { title: "Analyst" } });
    expect(reserveMeteredCall.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0] ?? 0,
    );
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      settleMeteredCall.mock.invocationCallOrder[0] ?? 0,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-5-5",
        max_tokens: 4000,
        system: baseArgs.system,
        output_config: expect.objectContaining({ effort: "low" }),
      }),
    );
    expect(aiCallCreate).not.toHaveBeenCalled();
    expect(settleMeteredCall).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "hold-1",
        userId: "user-1",
        kind: "ANALYZE",
        success: true,
        errorCode: null,
        inputTokens: 100,
        outputTokens: 20,
        costMicros: 20,
      }),
    );
    const logged = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logged).not.toContain("Office assistant");
    expect(logged).not.toContain("Analyst");
  });

  it("maps refusal and does not spend a bonus credit", async () => {
    create.mockResolvedValue(
      message({ stop_reason: "refusal", parsed_output: null, input_tokens: 50, output_tokens: 10 }),
    );

    const result = await runStructured(baseArgs);

    expect(result).toEqual({ ok: false, code: "AI_REFUSED" });
    expect(settleMeteredCall).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorCode: "AI_REFUSED",
        inputTokens: 50,
        outputTokens: 10,
      }),
    );
    expect(aiCallCreate).not.toHaveBeenCalled();
  });

  it("maps max_tokens to AI_TRUNCATED", async () => {
    create.mockResolvedValue(
      message({ stop_reason: "max_tokens", parsed_output: { title: "Partial" } }),
    );

    const result = await runStructured(baseArgs);

    expect(result).toEqual({ ok: false, code: "AI_TRUNCATED" });
    expect(settleMeteredCall).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, errorCode: "AI_TRUNCATED" }),
    );
  });

  it("maps a thrown SDK error and a bad response to AI_FAILED", async () => {
    create.mockRejectedValue(
      Object.assign(new Error("overloaded"), { status: 529, error: { type: "overloaded_error" } }),
    );
    const thrown = await runStructured(baseArgs);
    expect(thrown).toEqual({ ok: false, code: "AI_FAILED" });
    expect(settleMeteredCall).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorCode: "AI_FAILED",
        inputTokens: 0,
        outputTokens: 0,
        costMicros: 0,
      }),
    );
    expect(lastLog()).toContain('"stage":"provider"');
    expect(lastLog()).toContain('"status":529');
    expect(lastLog()).toContain('"errorType":"overloaded_error"');
    expect(lastLog()).not.toContain("Office assistant");

    create.mockResolvedValue(
      message({ stop_reason: "end_turn", text: "not-json", input_tokens: 12, output_tokens: 3 }),
    );
    const malformed = await runStructured(baseArgs);
    expect(malformed).toEqual({ ok: false, code: "AI_FAILED" });
    expect(settleMeteredCall).toHaveBeenLastCalledWith(
      expect.objectContaining({
        success: false,
        errorCode: "AI_FAILED",
        inputTokens: 12,
        outputTokens: 3,
      }),
    );
    expect(lastLog()).toContain('"stage":"validation"');
    expect(lastLog()).toContain('"code":"json"');
    expect(lastLog()).not.toContain("not-json");

    create.mockResolvedValue(message({ stop_reason: "end_turn", parsed_output: { title: 4 } }));
    const invalid = await runStructured(baseArgs);
    expect(invalid).toEqual({ ok: false, code: "AI_FAILED" });
    expect(lastLog()).toContain('"path":"title"');
    expect(lastLog()).not.toContain("Office assistant");
  });

  it("repairs optional fields before the schema check", async () => {
    create.mockResolvedValue(
      message({
        stop_reason: "end_turn",
        parsed_output: { title: "Analyst", employmentType: "UNKNOWN" },
      }),
    );

    const result = await runStructured({
      ...baseArgs,
      normalize: (value) => {
        if (!value || typeof value !== "object") return value;
        const record = value as { title?: unknown };
        return { title: record.title };
      },
    });

    expect(result).toEqual({ ok: true, data: { title: "Analyst" } });
    expect(settleMeteredCall).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, inputTokens: 100, outputTokens: 20 }),
    );
  });

  it("refuses the model call when the allowance is already held", async () => {
    reserveMeteredCall.mockResolvedValue({ ok: false });

    const result = await runStructured(baseArgs);

    expect(result).toEqual({ ok: false, code: "QUOTA_EXCEEDED" });
    expect(create).not.toHaveBeenCalled();
    expect(settleMeteredCall).not.toHaveBeenCalled();
    expect(lastLog()).toContain('"code":"QUOTA_EXCEEDED"');
    expect(lastLog()).not.toContain("Office assistant");
  });

  it("records a repair without taking another slot", async () => {
    create.mockResolvedValue(
      message({ stop_reason: "end_turn", parsed_output: { title: "Analyst" } }),
    );

    const result = await runStructured({ ...baseArgs, countsTowardQuota: false });

    expect(result.ok).toBe(true);
    expect(reserveMeteredCall).not.toHaveBeenCalled();
    expect(aiCallCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ success: true, usedBonusCredit: true }),
    });
  });

  it("allows an anonymous FREE_TOOL call", async () => {
    create.mockResolvedValue(
      message({ stop_reason: "end_turn", parsed_output: { title: "Analyst" } }),
    );

    const result = await runStructured({
      ...baseArgs,
      kind: "FREE_TOOL",
      userId: null,
      refId: undefined,
    });

    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith(
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
    expect(create).not.toHaveBeenCalled();
  });
});

function lastLog(): string {
  const calls = vi.mocked(console.info).mock.calls;
  return String(calls[calls.length - 1]?.[0] ?? "");
}
