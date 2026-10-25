/**
 * Whole-year tenure from snapshot dates, for the summary guard (G12).
 * docs/05-AI.md → The fabrication guard.
 * Round down. Year-only start is January; year-only end is December.
 */

import { parseResumeDate } from "@/features/library/dates";
import type { LibrarySnapshot } from "@/features/library/schemas";

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const WORD_NUMBER_PATTERN = Object.keys(WORD_NUMBERS).join("|");

const TENURE_PATTERN = new RegExp(
  String.raw`\b(?:(${WORD_NUMBER_PATTERN})|(\d+(?:\.\d+)?))\s*(?:\+|plus)?(?:\s*-?\s*years?|\s*-year|\s+at)\b`,
  "gi",
);

const EDUCATION_FOLLOWERS =
  /^(?:degree|program|diploma|certificate|bachelor|bachelor'?s|master|master'?s|honours|honors|course|courses)\b/i;

const EDUCATION_DURATION_PATTERN = new RegExp(
  String.raw`\b(?:${WORD_NUMBER_PATTERN}|\d+(?:\.\d+)?)\s*(?:\+|plus)?\s*-?\s*years?'?\s+(?:degree|program|diploma|certificate|bachelor|bachelor'?s|master|master'?s|honours|honors|course|courses)\b`,
  "gi",
);

const ORG_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "inc",
  "llc",
  "ltd",
  "co",
  "company",
  "corp",
  "corporation",
  "group",
  "studio",
  "university",
  "college",
]);

type SnapshotEntry = LibrarySnapshot["entries"][number];

export type OrgYears = {
  name: string;
  years: number;
};

export type SnapshotTenure = {
  /** Floored sum of EXPERIENCE entry months / 12. */
  experienceYears: number;
  /** Floored max EDUCATION entry months / 12. */
  educationYears: number;
  /** Max floored years of any entry at that organization. */
  organizations: OrgYears[];
};

export function snapshotTenure(snapshot: LibrarySnapshot): SnapshotTenure {
  const takenAt = parseTakenAt(snapshot.takenAt);
  let experienceMonths = 0;
  let educationYears = 0;
  const byOrg = new Map<
    string,
    { name: string; years: number; experienceMonths: number }
  >();

  for (const entry of snapshot.entries) {
    const months = entryMonths(entry, takenAt);
    const years = Math.floor(months / 12);
    if (entry.kind === "EXPERIENCE") experienceMonths += months;
    if (entry.kind === "EDUCATION") {
      educationYears = Math.max(educationYears, years);
    }
    const org = entry.organization?.trim();
    if (!org) continue;
    const key = normalize(org);
    const current = byOrg.get(key) ?? {
      name: org,
      years: 0,
      experienceMonths: 0,
    };
    if (entry.kind === "EXPERIENCE") current.experienceMonths += months;
    current.years = Math.max(
      current.years,
      years,
      Math.floor(current.experienceMonths / 12),
    );
    byOrg.set(key, current);
  }

  return {
    experienceYears: Math.floor(experienceMonths / 12),
    educationYears,
    organizations: [...byOrg.values()].map(({ name, years }) => ({
      name,
      years,
    })),
  };
}

/** Library text plus computed whole-year tenure figures the summary may use. */
export function libraryNumberSources(
  snapshot: LibrarySnapshot,
  tenure: SnapshotTenure,
): string[] {
  const parts: string[] = [];
  const { profile } = snapshot;
  if (profile.fullName) parts.push(profile.fullName);
  if (profile.headline) parts.push(profile.headline);
  if (profile.summary) parts.push(profile.summary);
  if (profile.location) parts.push(profile.location);
  for (const entry of snapshot.entries) {
    parts.push(entry.title);
    if (entry.organization) parts.push(entry.organization);
    if (entry.location) parts.push(entry.location);
    if (entry.startDate) parts.push(entry.startDate);
    if (entry.endDate) parts.push(entry.endDate);
    for (const bullet of entry.bullets) parts.push(bullet.text);
  }
  for (const skill of snapshot.skills) parts.push(skill.name);
  if (tenure.experienceYears > 0) parts.push(String(tenure.experienceYears));
  if (tenure.educationYears > 0) parts.push(String(tenure.educationYears));
  for (const org of tenure.organizations) {
    if (org.years > 0) parts.push(String(org.years));
  }
  return parts;
}

export function stripEducationDurationPhrases(text: string): string {
  return text.replace(EDUCATION_DURATION_PATTERN, " ");
}

export function hasOverstatedTenure(
  text: string,
  tenure: SnapshotTenure,
): boolean {
  TENURE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(TENURE_PATTERN)) {
    const claimed = claimedYears(match);
    if (claimed === null) continue;
    const after = text.slice((match.index ?? 0) + match[0].length).trim();
    const orgYears = matchingOrgYears(text, tenure);
    const education = EDUCATION_FOLLOWERS.test(after);
    const allowed = education
      ? (orgYears ?? tenure.educationYears)
      : (orgYears ?? tenure.experienceYears);
    if (claimed > allowed) return true;
  }
  return false;
}

function claimedYears(match: RegExpMatchArray): number | null {
  const word = match[1];
  if (word !== undefined) {
    const value = WORD_NUMBERS[word.toLowerCase()];
    return value === undefined ? null : value;
  }
  const digits = match[2];
  if (digits === undefined) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

function matchingOrgYears(
  text: string,
  tenure: SnapshotTenure,
): number | null {
  const haystack = normalize(text);
  let best: OrgYears | null = null;
  for (const org of tenure.organizations) {
    if (!orgAppearsIn(haystack, org.name)) continue;
    if (!best || org.name.length > best.name.length) best = org;
  }
  return best ? best.years : null;
}

function orgAppearsIn(haystack: string, name: string): boolean {
  const normalized = normalize(name);
  if (normalized.length >= 3 && haystack.includes(normalized)) return true;
  for (const word of normalized.split(" ")) {
    if (word.length < 6 || ORG_STOPWORDS.has(word)) continue;
    if (haystack.includes(word)) return true;
  }
  return false;
}

function entryMonths(
  entry: SnapshotEntry,
  takenAt: YearMonth | null,
): number {
  const start = yearMonth(entry.startDate, "start");
  const end = entry.isCurrent
    ? takenAt
    : yearMonth(entry.endDate, "end");
  if (!start || !end) return 0;
  const months = end.year * 12 + end.month - (start.year * 12 + start.month) + 1;
  return months > 0 ? months : 0;
}

type YearMonth = { year: number; month: number };

function yearMonth(
  value: string | null,
  edge: "start" | "end",
): YearMonth | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) return null;
  const parsed = parseResumeDate(trimmed);
  if (!parsed) return null;
  return {
    year: parsed.year,
    month: parsed.month ?? (edge === "end" ? 12 : 1),
  };
}

function parseTakenAt(takenAt: string): YearMonth | null {
  const date = new Date(takenAt);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
