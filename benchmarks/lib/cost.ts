/**
 * Planning estimates only. Figures match src/lib/ai/pricing.ts for
 * claude-sonnet-5-5 ($2 / $10 per million input / output) and
 * claude-haiku-5-5 short prompts ($0.10 / $0.50). Not a provider invoice.
 */

const SONNET_IN = 2;
const SONNET_OUT = 10;
const HAIKU_IN = 0.1;
const HAIKU_OUT = 0.5;

function usd(inputTokens: number, outputTokens: number, inputRate: number, outputRate: number): number {
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}

export type CostLine = { name: string; usd: number };

export type CostEstimate = {
  perCase: number;
  lines: CostLine[];
  note: string;
};

const LINES: CostLine[] = [
  { name: "RoleRefine import (end-to-end track, Sonnet)", usd: usd(8000, 4000, SONNET_IN, SONNET_OUT) },
  { name: "Job analysis (Haiku)", usd: usd(4000, 1500, HAIKU_IN, HAIKU_OUT) },
  { name: "RoleRefine tailor (Sonnet)", usd: usd(9000, 5000, SONNET_IN, SONNET_OUT) },
  { name: "One follow-up repair or revision, not both", usd: usd(4000, 3000, SONNET_IN, SONNET_OUT) },
  { name: "Direct baseline (Sonnet)", usd: usd(6000, 4000, SONNET_IN, SONNET_OUT) },
];

export function estimateCase(): CostEstimate {
  const perCase = LINES.reduce((sum, line) => sum + line.usd, 0);
  return {
    perCase,
    lines: LINES,
    note: "Worst-case planning estimate for both tracks. A clean tailor skips the follow-up. Provider billing can differ.",
  };
}

export function estimateRun(caseCount: number): number {
  return estimateCase().perCase * caseCount;
}

export type SpendGate =
  | { ok: true; maxUsd: number; estimatedUsd: number }
  | { ok: false; reason: string };

export function authorizeSpend(input: {
  confirmSpend: boolean;
  maxUsd: number | null;
  estimatedUsd: number;
}): SpendGate {
  if (!input.confirmSpend) {
    return { ok: false, reason: "Refusing paid calls. Pass --confirm-spend to authorize a run." };
  }
  if (input.maxUsd === null || !Number.isFinite(input.maxUsd) || input.maxUsd <= 0) {
    return { ok: false, reason: "Refusing paid calls. Pass --max-usd with a positive cap." };
  }
  if (input.estimatedUsd > input.maxUsd) {
    return {
      ok: false,
      reason: `Estimated $${input.estimatedUsd.toFixed(2)} exceeds the cap of $${input.maxUsd.toFixed(2)}. No requests were sent.`,
    };
  }
  return { ok: true, maxUsd: input.maxUsd, estimatedUsd: input.estimatedUsd };
}
