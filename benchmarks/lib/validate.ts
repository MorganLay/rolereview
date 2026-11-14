import { FITS, type BenchmarkCase } from "./types";
import {
  candidateIds,
  equalEvidenceInput,
  fileExists,
  groundTruth,
  loadCases,
  loadSmokeIds,
} from "./load";

export type FixtureIssue = { code: string; detail: string };

type Truth = {
  candidateId: string;
  provenance: string;
  facts: { id: string; status: string; text: string }[];
  unsupportedQualifications: string[];
};

export function validateFixtures(): FixtureIssue[] {
  const issues: FixtureIssue[] = [];
  const cases = loadCases();
  const ids = new Set<string>();
  const fits = new Set<string>();
  for (const testCase of cases) {
    if (ids.has(testCase.id)) issues.push({ code: "duplicate", detail: testCase.id });
    ids.add(testCase.id);
    fits.add(testCase.fit);
    issues.push(...validateCase(testCase));
  }
  for (const fit of FITS) {
    if (!fits.has(fit)) issues.push({ code: "fit", detail: `No ${fit} case.` });
  }
  for (const id of loadSmokeIds()) {
    if (!ids.has(id)) issues.push({ code: "smoke", detail: `${id} is not a case.` });
  }
  if (loadSmokeIds().length !== 12) {
    issues.push({ code: "smoke", detail: "The smoke suite must contain 12 cases." });
  }
  const sourced = new Set<string>();
  for (const candidateId of candidateIds()) {
    if (!fileExists(`fixtures/candidates/${candidateId}/ground-truth.json`)) {
      issues.push({ code: "candidate", detail: `${candidateId} has no ground truth.` });
      continue;
    }
    const truth = groundTruth(candidateId) as Truth;
    if (truth.provenance === "real-anonymized") sourced.add(candidateId);
    const allowed = new Set(["real-anonymized", "synthetic", "adapted", "public-example"]);
    if (!allowed.has(truth.provenance)) {
      issues.push({ code: "provenance", detail: candidateId });
    }
  }
  if (sourced.size < 5) {
    issues.push({ code: "provenance", detail: "Fewer than 5 sourced candidates." });
  }
  return issues;
}

function validateCase(testCase: BenchmarkCase): FixtureIssue[] {
  const issues: FixtureIssue[] = [];
  const required: [string, string][] = [
    ["whyCandidate", testCase.whyCandidate],
    ["whyJob", testCase.whyJob],
    ["success", testCase.success],
    ["whyItMatters", testCase.whyItMatters],
  ];
  for (const [field, value] of required) {
    if (value.trim().length < 80) {
      issues.push({ code: "justification", detail: `${testCase.id} ${field} is too thin.` });
    }
  }
  if (testCase.failureModes.length < 2) {
    issues.push({ code: "justification", detail: `${testCase.id} needs failure modes.` });
  }
  if (testCase.includeEvidence.length === 0 || testCase.avoidClaims.length === 0) {
    issues.push({ code: "justification", detail: `${testCase.id} needs evidence and avoided claims.` });
  }
  if (!FITS.includes(testCase.fit)) {
    issues.push({ code: "fit", detail: testCase.id });
  }
  if (!fileExists(`fixtures/candidates/${testCase.candidateId}/original-resume.txt`)) {
    issues.push({ code: "candidate", detail: testCase.id });
  }
  if (!fileExists(`fixtures/jobs/${testCase.jobId}.md`) || !fileExists(`fixtures/jobs/${testCase.jobId}.source.json`)) {
    issues.push({ code: "job", detail: testCase.id });
  }
  const blob = JSON.stringify(testCase).toLowerCase();
  if (blob.includes("rolerefine wins") || blob.includes("baseline wins")) {
    issues.push({ code: "frozen", detail: `${testCase.id} names a winner.` });
  }
  const input = equalEvidenceInput(testCase);
  const hidden = `${input.resume}\n${input.job}`;
  if (hidden.includes("unsupportedQualifications") || hidden.includes("whyItMatters")) {
    issues.push({ code: "leak", detail: `${testCase.id} gives the model evaluator notes.` });
  }
  if (testCase.candidateId.startsWith("P")) {
    const truth = groundTruth(testCase.candidateId) as Truth;
    for (const fact of truth.facts) {
      if (fact.status === "supported" && !input.resume.includes(fact.text)) {
        issues.push({ code: "ground-truth", detail: `${fact.id} is not in the resume text.` });
      }
    }
  }
  return issues;
}
