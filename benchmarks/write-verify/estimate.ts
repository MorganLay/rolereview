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

const OUTPUT_DRAFT = 2000;
const OUTPUT_COVERAGE = 1200;
const OUTPUT_FIX_W2 = 400;
const FIX_INPUT_W2 = 1800;
const COVERAGE_INPUT_PAD = 2500;

export function estimateW2(caseIds: readonly string[] = EXPERIMENT_CASES): {
  draftUsd: number;
  coverageUsd: number;
  fixUsd: number;
  worstUsd: number;
  note: string;
} {
  let draftUsd = 0;
  for (const id of caseIds) {
    const testCase = loadCase(id);
    if (!testCase) throw new Error(`Unknown case ${id}.`);
    const evidence = equalEvidenceInput(testCase);
    const snapshot = adaptFixtureResume(evidence.resume).snapshot;
    const written = writeVerifyMessage(snapshot, evidence.job);
    const tokens = Math.ceil((writeVerifyPrompt().length + written.text.length) / 4);
    draftUsd += usd(tokens, OUTPUT_DRAFT);
  }
  const coverageUsd = usd(COVERAGE_INPUT_PAD, OUTPUT_COVERAGE) * caseIds.length;
  const fixUsd = usd(FIX_INPUT_W2, OUTPUT_FIX_W2) * caseIds.length;
  return {
    draftUsd,
    coverageUsd,
    fixUsd,
    worstUsd: draftUsd + coverageUsd + fixUsd,
    note: "Worst case is one W2 draft, one coverage call, and one fix call for every resume. The saved direct resumes and the saved W drafts are not called again. Output sizes are planning caps.",
  };
}

const OUTPUT_CUT = 600;
const CUT_INPUT = 4000;
const OUTPUT_IMPORT = 5000;

export const IMPORT_CASES = ["P001-J001", "P006-J047", "P014-J055"] as const;

export function estimateW21(): {
  draftUsd: number;
  coverageUsd: number;
  fixUsd: number;
  cutUsd: number;
  importUsd: number;
  worstUsd: number;
  note: string;
} {
  const arms = EXPERIMENT_CASES.length + IMPORT_CASES.length;
  let draftUsd = 0;
  let importUsd = 0;
  for (const id of EXPERIMENT_CASES) {
    const testCase = loadCase(id);
    if (!testCase) throw new Error(`Unknown case ${id}.`);
    const evidence = equalEvidenceInput(testCase);
    const snapshot = adaptFixtureResume(evidence.resume).snapshot;
    const written = writeVerifyMessage(snapshot, evidence.job);
    const tokens = Math.ceil((writeVerifyPrompt().length + written.text.length) / 4);
    draftUsd += usd(tokens, OUTPUT_DRAFT);
    if ((IMPORT_CASES as readonly string[]).includes(id)) draftUsd += usd(tokens, OUTPUT_DRAFT);
  }
  for (const id of IMPORT_CASES) {
    const testCase = loadCase(id);
    if (!testCase) throw new Error(`Unknown case ${id}.`);
    const evidence = equalEvidenceInput(testCase);
    const tokens = Math.ceil((evidence.resume.length + 2500) / 4);
    importUsd += usd(tokens, OUTPUT_IMPORT);
  }
  const coverageUsd = usd(COVERAGE_INPUT_PAD, OUTPUT_COVERAGE) * arms;
  const fixUsd = usd(FIX_INPUT_W2, OUTPUT_FIX_W2) * arms;
  const cutUsd = usd(CUT_INPUT, OUTPUT_CUT) * arms;
  return {
    draftUsd,
    coverageUsd,
    fixUsd,
    cutUsd,
    importUsd,
    worstUsd: draftUsd + coverageUsd + fixUsd + cutUsd + importUsd,
    note: "Worst case is a draft, a coverage call, a fix, and a page-cut for each of the ten adapter resumes and the three imported libraries, plus three import calls. Output sizes are planning caps. A page that already fits skips the cut.",
  };
}

export function estimateW3(): {
  importUsd: number;
  w3Usd: number;
  productionUsd: number;
  worstUsd: number;
  note: string;
} {
  let importUsd = 0;
  let w3Usd = 0;
  for (const id of EXPERIMENT_CASES) {
    const testCase = loadCase(id);
    if (!testCase) throw new Error(`Unknown case ${id}.`);
    const evidence = equalEvidenceInput(testCase);
    const snapshot = adaptFixtureResume(evidence.resume).snapshot;
    const written = writeVerifyMessage(snapshot, evidence.job);
    const tokens = Math.ceil((writeVerifyPrompt().length + written.text.length) / 4);
    w3Usd += usd(tokens, OUTPUT_DRAFT);
    importUsd += usd(Math.ceil((evidence.resume.length + 2500) / 4), 5000);
  }
  const arms = EXPERIMENT_CASES.length;
  w3Usd += usd(COVERAGE_INPUT_PAD, OUTPUT_COVERAGE) * arms;
  w3Usd += usd(FIX_INPUT_W2, OUTPUT_FIX_W2) * arms;
  w3Usd += usd(4000, 600) * arms;
  const productionUsd = (usd(8000, 4000) + usd(4000, 1500) * 0.1 + usd(5000, 2500) * 2) * arms;
  return {
    importUsd,
    w3Usd,
    productionUsd,
    worstUsd: importUsd + w3Usd + productionUsd,
    note: "Worst case is an import, a W3 draft, a coverage call, a fix, and a page-cut for every resume, plus a production analyze, tailor, and two follow-ups. The run stops before a call that could pass $2.00. Output sizes are planning caps.",
  };
}

export function estimateW4(): {
  promptUsd: number;
  repairUsd: number;
  w4Usd: number;
  worstUsd: number;
  note: string;
} {
  let promptUsd = 0;
  let repairUsd = 0;
  let w4Usd = 0;
  for (const id of EXPERIMENT_CASES) {
    const testCase = loadCase(id);
    if (!testCase) throw new Error(`Unknown case ${id}.`);
    const evidence = equalEvidenceInput(testCase);
    const snapshot = adaptFixtureResume(evidence.resume).snapshot;
    const written = writeVerifyMessage(snapshot, evidence.job);
    const tokens = Math.ceil((writeVerifyPrompt().length + written.text.length) / 4);
    w4Usd += usd(tokens, OUTPUT_DRAFT);
    const importTokens = Math.ceil((evidence.resume.length + 2500) / 4);
    promptUsd += usd(importTokens, 3000);
    repairUsd += usd(importTokens * 2, 2500);
  }
  const arms = EXPERIMENT_CASES.length;
  w4Usd += usd(COVERAGE_INPUT_PAD, OUTPUT_COVERAGE) * arms;
  w4Usd += usd(FIX_INPUT_W2, OUTPUT_FIX_W2) * arms;
  w4Usd += usd(CUT_INPUT, OUTPUT_CUT) * arms;
  return {
    promptUsd,
    repairUsd,
    w4Usd,
    worstUsd: promptUsd + repairUsd + w4Usd,
    note: "Worst case is one repair, one W4 draft, a coverage call, a fix, and a page-cut for every resume, plus a second import that only tests the proposed prompt. Saved direct and production resumes are not called. The real import calls from the W3 run are reused. The run stops before a call that could pass $1.25. Output sizes are planning caps.",
  };
}

export function estimateW5(): {
  repairUsd: number;
  w5Usd: number;
  worstUsd: number;
  note: string;
} {
  let repairUsd = 0;
  let w5Usd = 0;
  for (const id of EXPERIMENT_CASES) {
    const testCase = loadCase(id);
    if (!testCase) throw new Error(`Unknown case ${id}.`);
    const evidence = equalEvidenceInput(testCase);
    const snapshot = adaptFixtureResume(evidence.resume).snapshot;
    const written = writeVerifyMessage(snapshot, evidence.job);
    const tokens = Math.ceil((writeVerifyPrompt().length + written.text.length) / 4);
    w5Usd += usd(tokens, OUTPUT_DRAFT);
    const importTokens = Math.ceil((evidence.resume.length + 2500) / 4);
    repairUsd += usd(importTokens * 2, 2500);
  }
  const arms = EXPERIMENT_CASES.length;
  w5Usd += usd(COVERAGE_INPUT_PAD, OUTPUT_COVERAGE) * arms;
  w5Usd += usd(FIX_INPUT_W2, OUTPUT_FIX_W2) * arms;
  w5Usd += usd(CUT_INPUT, OUTPUT_CUT) * arms * 3;
  return {
    repairUsd,
    w5Usd,
    worstUsd: repairUsd + w5Usd,
    note: "Worst case is one repair, one W5 draft, a coverage call, a fix, and three page-cuts for every resume. Saved direct and production resumes are not called. The real import calls from the W3 run are reused. The run stops before a call that could pass $1.00. Output sizes are planning caps.",
  };
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
