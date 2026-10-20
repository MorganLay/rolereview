import { strings } from "@/copy/strings";
import type {
  EmploymentType,
  PayPeriod,
  WorkMode,
} from "@/generated/prisma/enums";
import type { AnalyzeOutput } from "@/lib/ai/prompts/analyze";

import type { JobAnalysis } from "./schemas";
import { JobAnalysis as JobAnalysisSchema } from "./schemas";

/**
 * ANALYZE post-processing and column prefill. No model call and no writes.
 * docs/05-AI.md → ANALYZE.
 */

const placeholders = strings.jobs.placeholders;

export const ANALYZE_LIMITS = {
  requirements: 20,
  keywords: 30,
} as const;

/** A PENDING analysis older than this is treated as FAILED. */
export const ANALYSIS_STALE_MS = 5 * 60 * 1000;

const SALARY_MAX = 2_147_483_647;

export type JobDetailColumns = {
  title: string;
  company: string;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: PayPeriod | null;
  referenceNumber: string | null;
};

export type JobDetailPatch = Partial<JobDetailColumns>;

export function displayedAnalysisStatus(
  status: "PENDING" | "READY" | "FAILED",
  updatedAt: Date,
  now: Date,
): "PENDING" | "READY" | "FAILED" {
  if (status === "PENDING" && isStale(updatedAt, now)) return "FAILED";
  return status;
}

/** FAILED, or PENDING that has been waiting at least 5 minutes. */
export function canRetryAnalysis(
  status: "PENDING" | "READY" | "FAILED",
  updatedAt: Date,
  now: Date,
): boolean {
  if (status === "FAILED") return true;
  return status === "PENDING" && isStale(updatedAt, now);
}

function isStale(updatedAt: Date, now: Date): boolean {
  return now.getTime() - updatedAt.getTime() >= ANALYSIS_STALE_MS;
}

export function postProcessAnalyze(output: AnalyzeOutput): JobAnalysis {
  const salary = cleanSalary(output.salary);
  const analysis: JobAnalysis = {
    title: output.title.trim() || placeholders.title,
    company: output.company.trim() || placeholders.company,
    location: blankToNull(output.location),
    seniority: output.seniority,
    workMode: output.workMode,
    employmentType: output.employmentType,
    salary,
    referenceNumber: blankToNull(output.referenceNumber),
    summary: output.summary.trim(),
    requirements: cleanRequirements(output.requirements),
    keywords: cleanKeywords(output.keywords),
  };
  return JobAnalysisSchema.parse(analysis);
}

/**
 * Fill title, company, location, and the classification columns only where
 * the job still has the create-time placeholder or an empty value.
 */
export function prefillFromAnalysis(
  current: JobDetailColumns,
  analysis: JobAnalysis,
): JobDetailPatch {
  const patch: JobDetailPatch = {};
  if (current.title === placeholders.title && analysis.title !== current.title) {
    patch.title = analysis.title;
  }
  if (
    current.company === placeholders.company &&
    analysis.company !== current.company
  ) {
    patch.company = analysis.company;
  }
  if (current.location === null && analysis.location !== null) {
    patch.location = analysis.location;
  }
  if (current.workMode === "UNKNOWN" && analysis.workMode !== "UNKNOWN") {
    patch.workMode = analysis.workMode;
  }
  if (current.employmentType === null && analysis.employmentType !== null) {
    patch.employmentType = analysis.employmentType;
  }
  const salaryUnset =
    current.salaryMin === null &&
    current.salaryMax === null &&
    current.salaryCurrency === null &&
    current.salaryPeriod === null;
  if (salaryUnset && analysis.salary) {
    patch.salaryMin = analysis.salary.min;
    patch.salaryMax = analysis.salary.max;
    patch.salaryCurrency = analysis.salary.currency;
    patch.salaryPeriod = analysis.salary.period;
  }
  if (current.referenceNumber === null && analysis.referenceNumber !== null) {
    patch.referenceNumber = analysis.referenceNumber;
  }
  return patch;
}

function blankToNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function cleanRequirements(
  requirements: AnalyzeOutput["requirements"],
): JobAnalysis["requirements"] {
  const kept: AnalyzeOutput["requirements"] = [];
  for (const requirement of requirements) {
    if (requirement.text.trim().length === 0) continue;
    kept.push(requirement);
    if (kept.length === ANALYZE_LIMITS.requirements) break;
  }
  return kept.map((requirement, index) => ({
    id: `r${index + 1}`,
    text: requirement.text.trim(),
    kind: requirement.kind,
    importance: requirement.importance,
  }));
}

function cleanKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const keyword of keywords) {
    const text = keyword.trim();
    if (text.length === 0) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(text);
    if (kept.length === ANALYZE_LIMITS.keywords) break;
  }
  return kept;
}

function cleanSalary(salary: AnalyzeOutput["salary"]): JobAnalysis["salary"] {
  if (!salary) return null;
  let min = money(salary.min);
  let max = money(salary.max);
  if (min !== null && max !== null && min > max) {
    const swap = min;
    min = max;
    max = swap;
  }
  if (min === null && max === null) return null;
  return {
    min,
    max,
    currency: currencyCode(salary.currency),
    period: salary.period,
  };
}

function money(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > SALARY_MAX) return null;
  return rounded;
}

function currencyCode(value: string | null): string | null {
  if (value === null) return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}
