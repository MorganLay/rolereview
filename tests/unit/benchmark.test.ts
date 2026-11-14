import { describe, expect, it } from "vitest";

import { blindPacket, packetHidesIdentity } from "../../benchmarks/lib/blind";
import { authorizeSpend, estimateRun } from "../../benchmarks/lib/cost";
import { equalEvidenceInput, loadCase } from "../../benchmarks/lib/load";
import { caseReport, overallReport } from "../../benchmarks/lib/report";
import { validateFixtures } from "../../benchmarks/lib/validate";

describe("resume benchmark", () => {
  it("accepts the curated fixtures", () => {
    expect(validateFixtures()).toEqual([]);
  });

  it("keeps evaluator notes out of the model input", () => {
    const testCase = loadCase("P005-J015");
    expect(testCase).toBeDefined();
    const input = equalEvidenceInput(testCase!);
    expect(input.resume).toContain("GCIH");
    expect(input.resume).not.toContain("AI guardrail");
    expect(input.job).not.toContain("whyItMatters");
  });

  it("refuses an unpaid or over-budget run", () => {
    expect(authorizeSpend({ confirmSpend: false, maxUsd: 5, estimatedUsd: 1 }).ok).toBe(false);
    expect(authorizeSpend({ confirmSpend: true, maxUsd: null, estimatedUsd: 1 }).ok).toBe(false);
    expect(authorizeSpend({ confirmSpend: true, maxUsd: 1, estimatedUsd: estimateRun(12) }).ok).toBe(false);
    expect(authorizeSpend({ confirmSpend: true, maxUsd: 100, estimatedUsd: estimateRun(1) }).ok).toBe(true);
  });

  it("hides which system wrote which resume", () => {
    const hidden = blindPacket({
      caseId: "P005-J013",
      runId: "test-run",
      job: "Incident response",
      originalResume: "Security engineer",
      roleRefine: "Kept the IR playbook.",
      baseline: "Kept the IR playbook and the certification.",
      groundTruthFacts: ["GCIH"],
    });
    expect(packetHidesIdentity(hidden.packet)).toBe(true);
    expect(hidden.packet.resumeA === hidden.packet.resumeB).toBe(false);
  });

  it("does not invent a winner when nothing has been generated", () => {
    const testCase = loadCase("P002-J004");
    const report = caseReport(testCase!, "not-run");
    expect(report).toContain("Not yet evaluated");
    expect(report).not.toContain("Winner: RoleRefine");
    const overall = overallReport({ caseCount: 17, sourcedCandidates: 5, syntheticCandidates: 2 });
    expect(overall).toContain("Unanswered");
  });

  it("labels a formatter example as simulated", () => {
    const testCase = loadCase("S001-J016");
    expect(caseReport(testCase!, "mocked")).toContain("SIMULATED");
  });
});
