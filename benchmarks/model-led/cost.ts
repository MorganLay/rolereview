/**
 * Planning estimates for a three-arm comparison. Not a provider invoice.
 * Rates match benchmarks/lib/cost.ts. The import model is not called:
 * the library is the normalized snapshot.
 */
import { estimateCase } from "../lib/cost";

const SONNET_IN = 2;
const SONNET_OUT = 10;

function usd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * SONNET_IN + outputTokens * SONNET_OUT) / 1_000_000;
}

export const MODEL_LED_SMOKE = [
  "P014-J055",
  "P006-J047",
  "P011-J052",
  "P012-J037",
  "P005-J013",
  "P001-J012",
] as const;

export type ThreeArmEstimate = {
  onePassUsd: number;
  worstCaseUsd: number;
  armCOnePassUsd: number;
  armCWorstUsd: number;
  lines: { name: string; usd: number }[];
  note: string;
};

export function estimateThreeArm(caseCount: number): ThreeArmEstimate & { runOnePassUsd: number; runWorstUsd: number } {
  const sharedAnalysis = estimateCase().lines.find((line) => line.name.startsWith("Job analysis"))?.usd ?? 0;
  const production = usd(9000, 5000);
  const productionFollow = usd(4000, 3000);
  const direct = usd(6000, 4000);
  const modelLed = usd(12000, 6000);
  const modelLedRevision = usd(8000, 4000);
  const modelLedPage = modelLedRevision;
  const lines = [
    { name: "Shared job analysis (Haiku), once", usd: sharedAnalysis },
    { name: "A. Current tailor (Sonnet)", usd: production },
    { name: "A. One follow-up, only when the guard or the editorial route asks", usd: productionFollow },
    { name: "B. Direct Claude (Sonnet)", usd: direct },
    { name: "C. Model-led resume (Sonnet)", usd: modelLed },
    { name: "C. One revision, only when the guard or coverage asks", usd: modelLedRevision },
    { name: "C. One more revision, only when the rendered resume exceeds two pages", usd: modelLedPage },
  ];
  const onePassUsd = sharedAnalysis + production + direct + modelLed;
  const worstCaseUsd = onePassUsd + productionFollow + modelLedRevision + modelLedPage;
  const armCOnePassUsd = modelLed * caseCount;
  const armCWorstUsd = (modelLed + modelLedRevision + modelLedPage) * caseCount;
  return {
    onePassUsd,
    worstCaseUsd,
    runOnePassUsd: onePassUsd * caseCount,
    runWorstUsd: worstCaseUsd * caseCount,
    armCOnePassUsd,
    armCWorstUsd,
    lines,
    note: "Worst case assumes every follow-up runs, including a second model-led call when the rendered resume exceeds two pages. A clean resume skips them. Arms A and B are the existing paid command, whose own gate still includes an import line this comparison does not call. Arm C is model-led. The same case ids and the same normalized library are required before comparing them.",
  };
}
