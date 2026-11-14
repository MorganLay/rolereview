import type { BenchmarkCase } from "./types";

export type RunStatus = "not-run" | "mocked";

export function caseReport(testCase: BenchmarkCase, status: RunStatus): string {
  const lines = [
    `# ${testCase.id}`,
    "",
    `**Profession:** ${testCase.profession}`,
    `**Seniority:** ${testCase.seniority}`,
    `**Intended fit:** ${testCase.fit}`,
    `**Capabilities:** ${testCase.capabilities.join(", ")}`,
    "",
    "## Why this case was selected",
    "",
    testCase.whyCandidate,
    "",
    testCase.whyJob,
    "",
    "## Test objective",
    "",
    testCase.capabilities.join(", "),
    "",
    "## Expected successful behaviour",
    "",
    testCase.success,
    "",
    "## Expected failure modes",
    "",
    ...testCase.failureModes.map((item) => `- ${item}`),
    "",
    "## Why this matters",
    "",
    testCase.whyItMatters,
    "",
    "## Outcome",
    "",
  ];
  if (status === "not-run") {
    lines.push(
      "Not yet evaluated. No RoleRefine output, baseline output, score, or winner is available.",
      "",
      "Scoring requires a saved generation plus a manual review. This report does not invent either.",
    );
  } else {
    lines.push(
      "SIMULATED. The outputs below are fixtures for the report formatter. They are not model results.",
      "",
      "Winner: not designated.",
    );
  }
  return lines.join("\n");
}

export function overallReport(input: { caseCount: number; sourcedCandidates: number; syntheticCandidates: number }): string {
  return [
    "# Benchmark report",
    "",
    "Status: ready but unevaluated. No paid comparison has been run.",
    "",
    `Cases: ${input.caseCount}. Sourced candidate profiles: ${input.sourcedCandidates}. Synthetic profiles: ${input.syntheticCandidates}.`,
    "",
    "## Questions this report does not answer",
    "",
    "- Is RoleRefine better than a direct API prompt? Unanswered.",
    "- In which professions does it perform better or worse? Unanswered.",
    "- Does factual grounding improve accuracy? Unanswered.",
    "- Is the additional API cost justified? Unanswered.",
    "- Which five product improvements does the evidence support? Unanswered. No evaluated failures are on record.",
    "",
    "Blind win rate, fabrication counts, and cost differences are omitted because they were not measured.",
    "",
    "Multiple jobs for one candidate are not independent observations. This sample is not a statistical model of the job market.",
  ].join("\n");
}
