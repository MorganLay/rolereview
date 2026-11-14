/**
 * Planning estimate for the write-then-verify experiment. Not a provider invoice.
 * Rates match src/lib/ai/pricing.ts for claude-sonnet-5-5.
 */
import { equalEvidenceInput, loadCase } from "../lib/load";
import { adaptFixtureResume } from "../lib/snapshot";
import { modelLedPrompt, modelLedUserMessage } from "../model-led/prompt";
import { writeVerifyMessage, writeVerifyPrompt } from "./prompt";

export const EXPERIMENT_CASES = [
  "P006-J047",
  "P011-J052",
  "P012-J037",
  "P014-J055",
  "P001-J001",
  "P008-J024",
  "P010-J028",
  "P013-J040",
  "P016-J050",
  "P017-J043",
] as const;

const SONNET_IN = 2;
const SONNET_OUT = 10;
const OUTPUT_O = 5000;
const OUTPUT_W = 4000;
const OUTPUT_FIX = 800;
const FIX_INPUT = 2500;

export type ExperimentEstimate = {
  armOUsd: number;
  armWUsd: number;
  fixWorstUsd: number;
  worstUsd: number;
  lines: { id: string; inputTokens: number; armOUsd: number; armWUsd: number }[];
  note: string;
};

function usd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * SONNET_IN + outputTokens * SONNET_OUT) / 1_000_000;
}

export function estimateExperiment(caseIds: readonly string[] = EXPERIMENT_CASES): ExperimentEstimate {
  const lines = caseIds.map((id) => {
    const testCase = loadCase(id);
    if (!testCase) throw new Error(`Unknown case ${id}.`);
    const evidence = equalEvidenceInput(testCase);
    const snapshot = adaptFixtureResume(evidence.resume).snapshot;
    const outcome = modelLedUserMessage({ snapshot, job: evidence.job, length: "auto" });
    const written = writeVerifyMessage(snapshot, evidence.job);
    const outcomeTokens = Math.ceil((modelLedPrompt().length + outcome.text.length) / 4);
    const writeTokens = Math.ceil((writeVerifyPrompt().length + written.text.length) / 4);
    return {
      id,
      inputTokens: Math.max(outcomeTokens, writeTokens),
      armOUsd: usd(outcomeTokens, OUTPUT_O),
      armWUsd: usd(writeTokens, OUTPUT_W),
    };
  });
  const armOUsd = lines.reduce((sum, line) => sum + line.armOUsd, 0);
  const armWUsd = lines.reduce((sum, line) => sum + line.armWUsd, 0);
  const fixWorstUsd = usd(FIX_INPUT, OUTPUT_FIX) * caseIds.length * 2;
  return {
    armOUsd,
    armWUsd,
    fixWorstUsd,
    worstUsd: armOUsd + armWUsd + fixWorstUsd,
    lines,
    note: "Worst case is one outcome-first draft, one write-then-verify draft, and one fix call for every resume on both of those arms. Output sizes are planning caps, not invoices. A resume with no flagged line skips the fix call.",
  };
}
