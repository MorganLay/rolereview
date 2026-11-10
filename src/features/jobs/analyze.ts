import { strings } from "@/copy/strings";
import type {
  EmploymentType,
  PayPeriod,
  WorkMode,
} from "@/generated/prisma/enums";
import type { AnalyzeOutput } from "@/lib/ai/prompts/analyze";

import {
  JOB_LIMITS,
  JobAnalysis as JobAnalysisSchema,
  type JobAnalysis,
} from "./schemas";

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

const SENIORITY = new Set(["intern", "entry", "mid", "senior", "lead", "unknown"]);

/**
 * Repair optional model fields before the strict schema runs.
 * A bad arrangement, salary, or label must not discard the rest of the analysis.
 * Returns the value unchanged when there is no analysis to keep.
 */
export function normalizeAnalyzeOutput(value: unknown): unknown {
  if (!isRecord(value) || !hasAnalysisBody(value)) return value;
  return {
    title: typeof value.title === "string" ? value.title : "",
    company: typeof value.company === "string" ? value.company : "",
    location: nullableText(value.location),
    seniority: normalizeSeniority(value.seniority),
    workMode: normalizeWorkMode(value.workMode),
    employmentType: normalizeEmployment(value.employmentType),
    salary: normalizeSalary(value.salary),
    referenceNumber: nullableText(value.referenceNumber),
    summary: typeof value.summary === "string" ? value.summary : "",
    requirements: normalizeRequirements(value.requirements),
    keywords: normalizeKeywords(value.keywords),
  };
}

/**
 * A blank URL can be filled from the posting. One link is enough.
 * Several links are used only when one sits next to “apply”.
 */
export function applicationUrlFromPosting(text: string): string | null {
  const found: { url: string; index: number }[] = [];
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const raw = match[0];
    if (!raw) continue;
    const cleaned = raw.replace(/[),.;:!?]+$/g, "");
    if (cleaned.length === 0 || cleaned.length > JOB_LIMITS.url) continue;
    let parsed: URL;
    try {
      parsed = new URL(cleaned);
    } catch {
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
    found.push({ url: cleaned, index: match.index ?? 0 });
  }
  if (found.length === 0) return null;
  const apply = found.filter((item) => {
    const start = Math.max(0, item.index - 80);
    return /\bapply\b/i.test(text.slice(start, item.index));
  });
  if (apply.length > 0) return apply[0]?.url ?? null;
  if (found.length === 1) return found[0]?.url ?? null;
  return null;
}

export function postProcessAnalyze(
  output: AnalyzeOutput,
  posting = "",
): JobAnalysis {
  const salary = cleanSalary(output.salary, {
    title: output.title,
    location: output.location,
    posting,
  });
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

function cleanSalary(
  salary: AnalyzeOutput["salary"],
  place: SalaryPlace,
): JobAnalysis["salary"] {
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
    currency: resolveSalaryCurrency(salary.currency, place),
    period: salary.period,
  };
}

function money(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > SALARY_MAX) return null;
  return rounded;
}

type SalaryPlace = {
  title: string;
  location: string | null;
  posting: string;
};

/** A code written in the posting beats a country guess. Bare "$" is not a code. */
const EXPLICIT_CURRENCY: { code: string; pattern: RegExp }[] = [
  { code: "CAD", pattern: /\b(?:CAD|CDN)\b|\bC\$|\bCA\$|\bcanadian dollars?\b/i },
  {
    code: "USD",
    pattern: /\bUSD\b|\bUS\$|\bU\.S\.\$|\b(?:u\.s\.|us|american) dollars?\b/i,
  },
  { code: "GBP", pattern: /\bGBP\b|£/ },
  { code: "EUR", pattern: /\bEUR\b|€/ },
  { code: "AUD", pattern: /\bAUD\b|\bA\$/ },
  { code: "NZD", pattern: /\bNZD\b/ },
];

const CANADA_WORD = /\bcanad(?:a|ian)\b/i;
const CANADA_PROVINCE =
  /\b(?:alberta|british columbia|manitoba|new brunswick|newfoundland(?: and labrador)?|nova scotia|ontario|prince edward island|quebec|québec|saskatchewan|yukon|northwest territories|nunavut)\b/i;
const CANADA_CODE = /(?:,\s*)(?:AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/;
const POSTING_CANADA =
  /\([^)\n]{0,80}\bcanada\b[^)\n]{0,80}\)|\bbased in canada\b|\blocated in canada\b|\blocation:\s*canada\b|,\s*canada\b|\bcanada\s*,/i;
const UNITED_STATES = /\b(?:united states|u\.s\.a\.|usa)\b/i;

function currencyCode(value: string | null): string | null {
  if (value === null) return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

function explicitCurrencies(text: string): string[] {
  return EXPLICIT_CURRENCY.filter((item) => item.pattern.test(text)).map(
    (item) => item.code,
  );
}

function heading(place: SalaryPlace): string {
  return `${place.title}\n${place.location ?? ""}`;
}

function canadaInHeading(place: SalaryPlace): boolean {
  const text = heading(place);
  return (
    CANADA_WORD.test(text) || CANADA_PROVINCE.test(text) || CANADA_CODE.test(text)
  );
}

/**
 * CAD when the role is in Canada and the posting does not name another
 * currency. A model USD is the usual miss on a Canadian title, so it is
 * replaced. An explicit USD, or any other stated code, is kept.
 */
function resolveSalaryCurrency(
  stated: string | null,
  place: SalaryPlace,
): string | null {
  const text = `${heading(place)}\n${place.posting}`;
  const explicit = explicitCurrencies(text);
  const code = currencyCode(stated);
  if (explicit.length === 1) return explicit[0] ?? null;
  if (explicit.length > 1) return code !== null && explicit.includes(code) ? code : null;
  if ((code === null || code === "USD") && roleInCanada(place)) return "CAD";
  return code;
}

function roleInCanada(place: SalaryPlace): boolean {
  const unitedStates = UNITED_STATES.test(heading(place));
  if (canadaInHeading(place)) return !unitedStates;
  if (unitedStates) return false;
  return CANADA_PROVINCE.test(place.posting) || POSTING_CANADA.test(place.posting);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAnalysisBody(record: Record<string, unknown>): boolean {
  if (typeof record.title === "string" && record.title.trim().length > 0) return true;
  if (typeof record.company === "string" && record.company.trim().length > 0) return true;
  if (typeof record.summary === "string" && record.summary.trim().length > 0) return true;
  if (Array.isArray(record.requirements) && record.requirements.length > 0) return true;
  if (Array.isArray(record.keywords) && record.keywords.length > 0) return true;
  return false;
}

function phrase(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function compact(value: unknown): string {
  return phrase(value).replace(/[\s_-]+/g, "");
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeSeniority(value: unknown): string {
  const raw = phrase(value);
  if (SENIORITY.has(raw)) return raw;
  const key = compact(value);
  if (key === "intern" || key === "internship") return "intern";
  if (["junior", "jr", "entrylevel", "newgrad", "graduate"].includes(key)) return "entry";
  if (key === "mid" || key === "intermediate" || key === "midlevel") return "mid";
  if (key === "senior" || key === "sr") return "senior";
  if (key === "lead" || key === "principal") return "lead";
  return "unknown";
}

function normalizeWorkMode(value: unknown): "ONSITE" | "HYBRID" | "REMOTE" | "UNKNOWN" {
  const key = compact(value);
  if (key === "onsite" || key === "office" || key === "inoffice") return "ONSITE";
  if (key === "hybrid") return "HYBRID";
  if (key === "remote") return "REMOTE";
  return "UNKNOWN";
}

function normalizeEmployment(value: unknown): JobAnalysis["employmentType"] {
  const key = compact(value);
  if (key === "" || key === "unknown" || key === "na" || key === "none") return null;
  const mapped: Record<string, NonNullable<JobAnalysis["employmentType"]>> = {
    fulltime: "FULL_TIME",
    parttime: "PART_TIME",
    contract: "CONTRACT",
    contractor: "CONTRACT",
    temporary: "TEMPORARY",
    temp: "TEMPORARY",
    internship: "INTERNSHIP",
    intern: "INTERNSHIP",
    coop: "CO_OP",
    other: "OTHER",
  };
  return mapped[key] ?? null;
}

function normalizePeriod(value: unknown): "HOUR" | "YEAR" | null {
  const key = compact(value);
  if (key === "year" || key === "yearly" || key === "annual" || key === "annually" || key === "peryear") {
    return "YEAR";
  }
  if (key === "hour" || key === "hourly" || key === "perhour") return "HOUR";
  return null;
}

function amount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/[kmb]\b/i.test(trimmed)) return null;
  const match = trimmed.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSalary(value: unknown): {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: "HOUR" | "YEAR" | null;
} | null {
  if (!isRecord(value)) return null;
  const min = amount(value.min);
  const max = amount(value.max);
  if (min === null && max === null) return null;
  return {
    min,
    max,
    currency: typeof value.currency === "string" ? value.currency : null,
    period: normalizePeriod(value.period),
  };
}

function normalizeKind(
  value: unknown,
): "skill" | "experience" | "education" | "certification" | "other" {
  const key = compact(value);
  if (key === "skill" || key === "skills") return "skill";
  if (key === "experience") return "experience";
  if (key === "education" || key === "degree") return "education";
  if (key === "certification" || key === "certificate" || key === "cert") return "certification";
  return "other";
}

function normalizeImportance(value: unknown): "must" | "nice" {
  const key = compact(value);
  if (["must", "required", "requirement", "mandatory", "minimum"].includes(key)) return "must";
  return "nice";
}

function normalizeRequirements(
  value: unknown,
): { text: string; kind: string; importance: string }[] {
  if (!Array.isArray(value)) return [];
  const kept: { text: string; kind: string; importance: string }[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.text !== "string") continue;
    kept.push({
      text: item.text,
      kind: normalizeKind(item.kind),
      importance: normalizeImportance(item.importance),
    });
  }
  return kept;
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
