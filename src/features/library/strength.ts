/**
 * Deterministic bullet strength. docs/05-AI.md → Bullet strength.
 * Six checks, score 0–6. Tiers: 0–2 Weak, 3 Fair, 4 Good, 5 Strong, 6 Excellent.
 */

import { strings } from "@/copy/strings";

import { STRONG_VERBS } from "./verbs";

export const CHECK_IDS = [
  "verb",
  "metric",
  "length",
  "voice",
  "filler",
  "specific",
] as const;

export type CheckId = (typeof CHECK_IDS)[number];

export const STRENGTH_TIERS = [
  "weak",
  "fair",
  "good",
  "strong",
  "excellent",
] as const;

export type StrengthTier = (typeof STRENGTH_TIERS)[number];

export type BulletStrength = {
  score: number;
  tier: StrengthTier;
  passed: CheckId[];
  fixes: string[];
};

/** Tools and domain terms that satisfy `specific` without a matching skill. */
export const KNOWN_TERMS = [
  "a/b testing",
  "agile",
  "ansible",
  "api",
  "aws",
  "azure",
  "bigquery",
  "c#",
  "c++",
  "ci/cd",
  "css",
  "datadog",
  "django",
  "docker",
  "dotnet",
  "elasticsearch",
  "excel",
  "figma",
  "flask",
  "gcp",
  "git",
  "github",
  "gitlab",
  "go",
  "golang",
  "grafana",
  "graphql",
  "hadoop",
  "html",
  "java",
  "javascript",
  "jenkins",
  "jest",
  "jira",
  "kafka",
  "kotlin",
  "kubernetes",
  "linux",
  "looker",
  "machine learning",
  "matlab",
  "mongodb",
  "mysql",
  "next.js",
  "nextjs",
  "node",
  "node.js",
  "nodejs",
  "numpy",
  "oracle",
  "pandas",
  "php",
  "playwright",
  "postgres",
  "postgresql",
  "power bi",
  "power query",
  "powerbi",
  "pytest",
  "python",
  "pytorch",
  "r",
  "react",
  "react native",
  "redis",
  "ruby",
  "rust",
  "salesforce",
  "sap",
  "sas",
  "sass",
  "scrum",
  "selenium",
  "snowflake",
  "spark",
  "splunk",
  "spss",
  "sql",
  "sqlite",
  "swift",
  "tableau",
  "tensorflow",
  "terraform",
  "typescript",
  "vba",
  "vue",
  "webpack",
  "wordpress",
] as const;

const FILLER_PHRASES = [
  "responsible for",
  "duties included",
  "various",
  "etc",
  "helped with",
  "tasked with",
  "worked on",
] as const;

const FIRST_PERSON = new Set([
  "i",
  "me",
  "my",
  "we",
  "our",
  "i'm",
  "i've",
  "i'd",
  "i'll",
  "we're",
  "we've",
  "we'd",
  "we'll",
]);

const MIN_WORDS = 8;
const MAX_WORDS = 32;

type Failure =
  | { id: "verb" | "voice" | "specific" }
  | { id: "metric"; kind: "missing" | "spelled" }
  | { id: "length"; kind: "short" | "long" }
  | { id: "filler"; phrase: string };

/** Quantity words. "one of" and "one-off" are not figures. */
const SPELLED_NUMBER =
  /\b(?:once|twice|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen)\b/i;

export function tierForScore(score: number): StrengthTier {
  if (score <= 2) return "weak";
  if (score === 3) return "fair";
  if (score === 4) return "good";
  if (score === 5) return "strong";
  return "excellent";
}

/** Weak fills 1 segment, Excellent fills 5. */
export function filledSegments(tier: StrengthTier): number {
  return STRENGTH_TIERS.indexOf(tier) + 1;
}

export function bulletStrength(
  text: string,
  skills: readonly string[],
): BulletStrength {
  const tokens = tokenize(text);
  const failures: Failure[] = [];

  if (!STRONG_VERBS.has(tokens[0] ?? "")) failures.push({ id: "verb" });
  if (!hasMetric(text)) {
    failures.push({
      id: "metric",
      kind: hasSpelledNumber(text) ? "spelled" : "missing",
    });
  }
  if (tokens.length < MIN_WORDS) failures.push({ id: "length", kind: "short" });
  else if (tokens.length > MAX_WORDS) failures.push({ id: "length", kind: "long" });
  if (tokens.some((token) => FIRST_PERSON.has(token))) failures.push({ id: "voice" });
  const phrase = fillerPhrase(text);
  if (phrase) failures.push({ id: "filler", phrase });
  if (!isSpecific(text, skills)) failures.push({ id: "specific" });

  const failed = new Set(failures.map((failure) => failure.id));
  const passed = CHECK_IDS.filter((id) => !failed.has(id));
  const score = passed.length;

  return {
    score,
    tier: tierForScore(score),
    passed,
    fixes: score >= CHECK_IDS.length ? [] : failures.map((failure) => fixFor(failure, score)),
  };
}

function fixFor(failure: Failure, score: number): string {
  const tier = nextTierLabel(score);
  const copy = strings.strength.fixes;
  switch (failure.id) {
    case "verb":
      return copy.verb(tier);
    case "metric":
      return failure.kind === "spelled" ? copy.metricDigit(tier) : copy.metric(tier);
    case "length":
      return failure.kind === "short" ? copy.lengthShort(tier) : copy.lengthLong(tier);
    case "voice":
      return copy.voice(tier);
    case "filler":
      return copy.filler(failure.phrase, tier);
    case "specific":
      return copy.specific(tier);
  }
}

function nextTierLabel(score: number): string {
  const current = tierForScore(score);
  const index = STRENGTH_TIERS.indexOf(current);
  const next = STRENGTH_TIERS[Math.min(index + 1, STRENGTH_TIERS.length - 1)] ?? "excellent";
  return strings.strength[next];
}

function tokenize(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  return trimmed.split(/\s+/).map(normalizeToken);
}

function normalizeToken(token: string): string {
  return token
    .replace(/[’‘]/g, "'")
    .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "")
    .toLowerCase();
}

function hasMetric(text: string): boolean {
  return /\d|%|\$/.test(text) || /\d+\s*x\b/i.test(text);
}

function hasSpelledNumber(text: string): boolean {
  const scrubbed = text
    .replace(/\bone-(?:off|time|on-one)\b/gi, " ")
    .replace(/\bone of\b/gi, " ");
  return SPELLED_NUMBER.test(scrubbed) || /\bone\b/i.test(scrubbed);
}

function fillerPhrase(text: string): string | null {
  for (const phrase of FILLER_PHRASES) {
    const body = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    if (new RegExp(`\\b${body}\\b`, "i").test(text)) return phrase;
  }
  return null;
}

function isSpecific(text: string, skills: readonly string[]): boolean {
  for (const term of KNOWN_TERMS) {
    if (mentionsTerm(text, term)) return true;
  }
  for (const skill of skills) {
    if (mentionsTerm(text, skill)) return true;
  }
  return false;
}

function mentionsTerm(text: string, term: string): boolean {
  const trimmed = term.trim();
  if (trimmed.length === 0) return false;
  const body = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^A-Za-z0-9])${body}(?=[^A-Za-z0-9]|$)`, "i").test(text);
}
