import "server-only";

/**
 * USD micros charged per 1,000,000 tokens. docs/05-AI.md → Cost model.
 * Claude pricing page, October 2026. Update this file when prices change.
 * Haiku 5.5 steps up once the prompt (input + cache read + cache write) exceeds 100,000 tokens.
 */
const HAIKU_LONG_PROMPT_TOKENS = 100_000;

type Rates = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
};

const SONNET_55: Rates = {
  input: 2_000_000,
  output: 10_000_000,
  cacheRead: 100_000,
  cacheWrite5m: 2_500_000,
  cacheWrite1h: 4_000_000,
};

const HAIKU_55_SHORT: Rates = {
  input: 100_000,
  output: 500_000,
  cacheRead: 10_000,
  cacheWrite5m: 125_000,
  cacheWrite1h: 200_000,
};

const HAIKU_55_LONG: Rates = {
  input: 500_000,
  output: 2_500_000,
  cacheRead: 50_000,
  cacheWrite5m: 625_000,
  cacheWrite1h: 1_000_000,
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
};

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
};

type ApiUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number | null;
  cache_creation_input_tokens: number | null;
  cache_creation: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  } | null;
};

/** Map a Messages API `usage` object. Missing cache breakdown is billed as 5-minute writes. */
export function tokenUsageFromApi(usage: ApiUsage): TokenUsage {
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  if (usage.cache_creation) {
    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens,
      cacheWrite5mTokens: usage.cache_creation.ephemeral_5m_input_tokens,
      cacheWrite1hTokens: usage.cache_creation.ephemeral_1h_input_tokens,
    };
  }
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens,
    cacheWrite5mTokens: usage.cache_creation_input_tokens ?? 0,
    cacheWrite1hTokens: 0,
  };
}

export function cacheWriteTokens(usage: TokenUsage): number {
  return usage.cacheWrite5mTokens + usage.cacheWrite1hTokens;
}

function ratesFor(model: string, promptTokens: number): Rates {
  if (model === "claude-sonnet-5-5") return SONNET_55;
  if (model === "claude-haiku-5-5") {
    return promptTokens > HAIKU_LONG_PROMPT_TOKENS ? HAIKU_55_LONG : HAIKU_55_SHORT;
  }
  throw new Error(`No price for model ${model}.`);
}

function line(tokens: number, microsPerMillion: number): number {
  if (tokens <= 0) return 0;
  return Math.round((tokens * microsPerMillion) / 1_000_000);
}

/** Estimated cost in millionths of a USD. */
export function estimateCostMicros(model: string, usage: TokenUsage): number {
  const promptTokens =
    usage.inputTokens +
    usage.cacheReadTokens +
    usage.cacheWrite5mTokens +
    usage.cacheWrite1hTokens;
  const rates = ratesFor(model, promptTokens);
  return (
    line(usage.inputTokens, rates.input) +
    line(usage.outputTokens, rates.output) +
    line(usage.cacheReadTokens, rates.cacheRead) +
    line(usage.cacheWrite5mTokens, rates.cacheWrite5m) +
    line(usage.cacheWrite1hTokens, rates.cacheWrite1h)
  );
}
