import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import type { BenchmarkCase } from "./types";

const root = path.join(process.cwd(), "benchmarks");

export function benchmarkRoot(): string {
  return root;
}

export function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8")) as T;
}

export function loadCases(): BenchmarkCase[] {
  return readJson<BenchmarkCase[]>("fixtures/cases.json");
}

export function loadCase(id: string): BenchmarkCase | undefined {
  return loadCases().find((item) => item.id === id);
}

export function loadSmokeIds(): string[] {
  const file = readJson<{ cases: { id: string }[] }>("fixtures/smoke-suite.json");
  return file.cases.map((item) => item.id);
}

export function candidateResume(candidateId: string): string {
  return readFileSync(
    path.join(root, "fixtures", "candidates", candidateId, "original-resume.txt"),
    "utf8",
  );
}

export function jobText(jobId: string): string {
  return readFileSync(path.join(root, "fixtures", "jobs", `${jobId}.md`), "utf8");
}

export function groundTruth(candidateId: string): unknown {
  return readJson(`fixtures/candidates/${candidateId}/ground-truth.json`);
}

export function candidateIds(): string[] {
  return readdirSync(path.join(root, "fixtures", "candidates"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export function fileExists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

/** Text both arms may see. Ground truth, justifications, and expected claims stay out. */
export function equalEvidenceInput(testCase: BenchmarkCase): { resume: string; job: string } {
  return {
    resume: candidateResume(testCase.candidateId),
    job: jobText(testCase.jobId),
  };
}
