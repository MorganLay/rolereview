import { describe, expect, it } from "vitest";

import { AI_TASKS } from "@/lib/ai/models";
import {
  EMPTY_USAGE,
  estimateCostMicros,
  tokenUsageFromApi,
  type TokenUsage,
} from "@/lib/ai/pricing";

function usage(partial: Partial<TokenUsage>): TokenUsage {
  return { ...EMPTY_USAGE, ...partial };
}

describe("estimateCostMicros", () => {
  it("prices every configured model", () => {
    for (const task of Object.values(AI_TASKS)) {
      expect(estimateCostMicros(task.model, EMPTY_USAGE)).toBe(0);
    }
  });

  it("rejects an unknown model", () => {
    expect(() => estimateCostMicros("claude-unknown", EMPTY_USAGE)).toThrow(
      /No price/,
    );
  });

  it("charges Sonnet input and output in micros", () => {
    expect(
      estimateCostMicros(
        "claude-sonnet-5-5",
        usage({ inputTokens: 1_000, outputTokens: 1_000_000 }),
      ),
    ).toBe(2_000 + 10_000_000);
  });

  it("uses the short Haiku rate at 100k prompt tokens and the long rate above it", () => {
    expect(
      estimateCostMicros("claude-haiku-5-5", usage({ inputTokens: 100_000 })),
    ).toBe(10_000);
    expect(
      estimateCostMicros("claude-haiku-5-5", usage({ inputTokens: 100_001 })),
    ).toBe(Math.round((100_001 * 500_000) / 1_000_000));
  });

  it("counts cache reads and writes toward the Haiku prompt size", () => {
    const cost = estimateCostMicros(
      "claude-haiku-5-5",
      usage({
        inputTokens: 90_000,
        cacheReadTokens: 20_000,
        outputTokens: 10,
      }),
    );
    const longInput = Math.round((90_000 * 500_000) / 1_000_000);
    const longRead = Math.round((20_000 * 50_000) / 1_000_000);
    const longOutput = Math.round((10 * 2_500_000) / 1_000_000);
    expect(cost).toBe(longInput + longRead + longOutput);
  });

  it("prices 5-minute and 1-hour cache writes separately", () => {
    expect(
      estimateCostMicros(
        "claude-sonnet-5-5",
        usage({ cacheWrite5mTokens: 1_000_000, cacheWrite1hTokens: 1_000_000 }),
      ),
    ).toBe(2_500_000 + 4_000_000);
  });

  it("rounds a fractional micro", () => {
    expect(
      estimateCostMicros("claude-haiku-5-5", usage({ outputTokens: 1 })),
    ).toBe(1);
  });
});

describe("tokenUsageFromApi", () => {
  it("treats a missing cache breakdown as 5-minute writes", () => {
    expect(
      tokenUsageFromApi({
        input_tokens: 10,
        output_tokens: 4,
        cache_read_input_tokens: 2,
        cache_creation_input_tokens: 7,
        cache_creation: null,
      }),
    ).toEqual(
      usage({
        inputTokens: 10,
        outputTokens: 4,
        cacheReadTokens: 2,
        cacheWrite5mTokens: 7,
      }),
    );
  });

  it("uses the TTL breakdown when the API sends one", () => {
    expect(
      tokenUsageFromApi({
        input_tokens: 10,
        output_tokens: 4,
        cache_read_input_tokens: null,
        cache_creation_input_tokens: 99,
        cache_creation: {
          ephemeral_5m_input_tokens: 3,
          ephemeral_1h_input_tokens: 5,
        },
      }),
    ).toEqual(
      usage({
        inputTokens: 10,
        outputTokens: 4,
        cacheWrite5mTokens: 3,
        cacheWrite1hTokens: 5,
      }),
    );
  });
});
