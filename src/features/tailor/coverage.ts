/**
 * How a requirement is supported in the library, and whether the draft shows it.
 * A job requirement is not evidence that the candidate has the skill.
 */

import type { JobAnalysis, Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { KNOWN_TERMS } from "@/features/library/strength";

const KNOWN = new Set<string>(KNOWN_TERMS);

import { normalizeMatchText, termAppears } from "./keywords";
import type { ValidatedTailorOutput } from "./schemas";

const ACADEMIC =
  /\b(coursework|course|assignment|class project|for a class|university course|academic)\b/i;
const HEDGE =
  /\b(familiar|familiarity|introductory|introduction|basic|exposure|introduced)\b/i;
const BUILD =
  /\b(built|build|developed|develop|implemented|implement|tested|test|integrated|integrate|deployed|deploy|debugged|debug)\b/i;

const PHRASES = [
  "pull request",
  "code review",
  "unit test",
  "integration test",
  "continuous integration",
  "version control",
  "oauth 2.0",
  "oauth",
];

const STOP = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "our",
  "into",
  "using",
  "have",
  "has",
  "will",
  "able",
  "work",
  "working",
  "experience",
  "including",
  "such",
  "other",
  "years",
  "year",
  "development",
  "professional",
  "software",
  "application",
  "applications",
  "environment",
  "tools",
  "knowledge",
  "ability",
  "skills",
  "skill",
  "team",
  "teams",
  "strong",
  "code",
  "review",
  "reviews",
  "pull",
  "request",
  "requests",
]);

export type LibraryEvidence = "direct" | "partial" | "skill_only" | "none";
export type Presented = "on_resume" | "in_library" | "absent";

export type RequirementCoverage = {
  requirementId: string;
  library: LibraryEvidence;
  presented: Presented;
  sourceRefs: string[];
};

type SnapshotEntry = LibrarySnapshot["entries"][number];

export function requirementCoverage(input: {
  analysis: JobAnalysis;
  snapshot: LibrarySnapshot;
  output: ValidatedTailorOutput;
}): RequirementCoverage[] {
  const shown = shownText(input.output, input.snapshot);
  return input.analysis.requirements.map((requirement) => {
    const terms = requirementTerms(requirement, input.analysis.keywords);
    const hits = supportingBullets(input.snapshot, terms);
    const skill = skillHit(input.snapshot, terms);
    const library = libraryLevel(hits, skill);
    const onBullet = terms.some((term) => hasTerm(shown.body, term));
    const onSkill = terms.some((term) => hasTerm(shown.skills, term));
    const presented: Presented =
      library === "none"
        ? "absent"
        : onBullet || (library === "skill_only" && onSkill)
          ? "on_resume"
          : "in_library";
    return {
      requirementId: requirement.id,
      library,
      presented,
      sourceRefs: hits.filter((hit) => hit.level === "direct").map((hit) => hit.ref),
    };
  });
}

export function requirementTerms(
  requirement: Requirement,
  keywords: readonly string[],
): string[] {
  const haystack = normalizeMatchText(requirement.text);
  const terms: string[] = [];
  for (const phrase of PHRASES) {
    if (termAppears(haystack, phrase)) terms.push(phrase);
  }
  for (const keyword of keywords) {
    const needle = normalizeMatchText(keyword);
    if (needle.length < 3 || !termAppears(haystack, needle)) continue;
    terms.push(keyword.trim());
  }
  for (const token of requirement.text.split(/[^A-Za-z0-9+.#]+/)) {
    const key = token.toLowerCase();
    if (STOP.has(key)) continue;
    if (token.length >= 4 || (token.length >= 3 && KNOWN.has(key))) {
      terms.push(token);
    }
  }
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const term of terms) {
    const key = normalizeMatchText(term);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(term);
  }
  return unique;
}

function libraryLevel(
  hits: readonly { level: "direct" | "partial" }[],
  skill: boolean,
): LibraryEvidence {
  if (hits.some((hit) => hit.level === "direct")) return "direct";
  if (hits.some((hit) => hit.level === "partial")) return "partial";
  if (skill) return "skill_only";
  return "none";
}

function supportingBullets(
  snapshot: LibrarySnapshot,
  terms: readonly string[],
): { ref: string; level: "direct" | "partial" }[] {
  const hits: { ref: string; level: "direct" | "partial" }[] = [];
  for (const entry of snapshot.entries) {
    for (const bullet of entry.bullets) {
      if (!terms.some((term) => hasTerm(bullet.text, term))) continue;
      hits.push({ ref: bullet.ref, level: bulletLevel(entry, bullet.text) });
    }
  }
  return hits;
}

function bulletLevel(entry: SnapshotEntry, text: string): "direct" | "partial" {
  if (entry.kind === "EDUCATION" || ACADEMIC.test(text)) return "partial";
  if (HEDGE.test(text) && !BUILD.test(text)) return "partial";
  return "direct";
}

function skillHit(snapshot: LibrarySnapshot, terms: readonly string[]): boolean {
  return snapshot.skills.some((skill) =>
    terms.some((term) => {
      const name = normalizeMatchText(skill.name);
      const needle = normalizeMatchText(term);
      return termAppears(name, needle) || termAppears(needle, name);
    }),
  );
}

function shownText(
  output: ValidatedTailorOutput,
  snapshot: LibrarySnapshot,
): { body: string; skills: string } {
  const parts: string[] = [output.summary];
  for (const entry of output.entries) {
    for (const bullet of entry.bullets) parts.push(bullet.text);
  }
  const skills: string[] = [];
  for (const group of output.skills) {
    for (const ref of group.refs) {
      const skill = snapshot.skills.find((item) => item.ref === ref);
      if (skill) skills.push(skill.name);
    }
  }
  return { body: loose(parts.join("\n")), skills: loose(skills.join("\n")) };
}

function hasTerm(text: string, term: string): boolean {
  const haystack = loose(text);
  const needle = normalizeMatchText(term);
  return termAppears(haystack, needle) || termAppears(haystack, `${needle}s`);
}

function loose(text: string): string {
  return normalizeMatchText(text).replace(/\.+(?![a-z0-9])/g, " ");
}
