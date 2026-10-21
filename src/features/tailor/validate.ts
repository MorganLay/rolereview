/**
 * Fabrication guard for a tailored resume.
 * docs/05-AI.md → The fabrication guard.
 * Pure: G1–G11 clean the model output before anything is saved.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";

import { RESUME_LIMITS } from "./schemas";
import type {
  RequirementMatch,
  TailorBullet,
  TailorOutput,
  TailorSkillGroup,
  ValidatedBullet,
  ValidatedTailorOutput,
} from "./schemas";

export const GUARD_CODES = [
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "G10",
  "G11",
] as const;

export type GuardCode = (typeof GUARD_CODES)[number];

/** A code and a ref id. Never bullet text or posting text. */
export type GuardIssue = {
  code: GuardCode;
  ref: string;
};

export type GuardResult = {
  output: ValidatedTailorOutput;
  reverts: number;
  issues: GuardIssue[];
};

const NOT_ASSESSED = "Not assessed.";

type SnapshotEntry = LibrarySnapshot["entries"][number];

/**
 * `$` amounts and numbers, including `1,000`, `1 000`, and a trailing `%`.
 * Commas and spaces inside a token are removed before comparison.
 */
const NUMBER =
  /(?:\$(?:\s*)(?:\d{1,3}(?:[, ]\d{3})+|\d+)(?:\.\d+)?)|(?:\d{1,3}(?:[, ]\d{3})+(?:\.\d+)?(?:\s*%)?)|(?:\d+(?:\.\d+)?(?:\s*%)?)/g;

export function validateTailorOutput(
  output: TailorOutput,
  snapshot: LibrarySnapshot,
  analysis: JobAnalysis,
): GuardResult {
  const issues: GuardIssue[] = [];
  const entries = cleanEntries(output.entries, snapshot, issues);
  return {
    output: {
      summary: output.summary,
      entries: entries.entries,
      skills: cleanSkills(output.skills, snapshot, issues),
      requirementMatches: cleanMatches(
        output.requirementMatches,
        analysis,
        snapshot,
        issues,
      ),
    },
    reverts: entries.reverts,
    issues,
  };
}

function cleanEntries(
  entries: TailorOutput["entries"],
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): { entries: ValidatedTailorOutput["entries"]; reverts: number } {
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  const seen = new Set<string>();
  const cleaned: ValidatedTailorOutput["entries"] = [];
  let reverts = 0;

  for (const entry of entries) {
    const snapshotEntry = byRef.get(entry.ref);
    if (!snapshotEntry) {
      issues.push({ code: "G1", ref: entry.ref });
      continue;
    }
    if (seen.has(entry.ref)) {
      issues.push({ code: "G2", ref: entry.ref });
      continue;
    }
    seen.add(entry.ref);
    const bullets = cleanBullets(entry.bullets, snapshotEntry, issues);
    reverts += bullets.reverts;
    cleaned.push({ ref: entry.ref, bullets: bullets.bullets });
  }

  for (const snapshotEntry of snapshot.entries) {
    if (snapshotEntry.kind !== "EDUCATION" || seen.has(snapshotEntry.ref)) {
      continue;
    }
    cleaned.push({ ref: snapshotEntry.ref, bullets: [] });
    issues.push({ code: "G11", ref: snapshotEntry.ref });
  }

  return { entries: cleaned, reverts };
}

function cleanBullets(
  bullets: readonly TailorBullet[],
  snapshotEntry: SnapshotEntry,
  issues: GuardIssue[],
): { bullets: ValidatedBullet[]; reverts: number } {
  const owned = new Map(
    snapshotEntry.bullets.map((bullet) => [bullet.ref, bullet.text]),
  );
  const kept: ValidatedBullet[] = [];
  const seen = new Set<string>();
  let reverts = 0;

  for (const bullet of bullets) {
    const sources: { ref: string; text: string }[] = [];
    for (const ref of bullet.sourceRefs) {
      const sourceText = owned.get(ref);
      if (sourceText === undefined) {
        issues.push({ code: "G3", ref });
        continue;
      }
      if (sources.some((source) => source.ref === ref)) continue;
      sources.push({ ref, text: sourceText });
    }

    const first = sources[0];
    if (first === undefined) continue;

    const key = sources
      .map((source) => source.ref)
      .sort()
      .join("\0");
    if (seen.has(key)) {
      issues.push({ code: "G6", ref: first.ref });
      continue;
    }
    seen.add(key);

    let text = bullet.text;
    let reverted = false;
    if (hasNewNumber(text, sources.map((source) => source.text))) {
      text = first.text;
      reverted = true;
      reverts += 1;
      issues.push({ code: "G4", ref: first.ref });
    } else if (text.trim().length === 0 || text.length > RESUME_LIMITS.bullet) {
      text = first.text;
      reverted = true;
      reverts += 1;
      issues.push({ code: "G5", ref: first.ref });
    }

    kept.push({
      sourceRefs: sources.map((source) => source.ref),
      text,
      reverted,
    });
  }

  return { bullets: kept, reverts };
}

function cleanSkills(
  groups: readonly TailorSkillGroup[],
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): TailorSkillGroup[] {
  const known = new Set(snapshot.skills.map((skill) => skill.ref));
  const cleaned: TailorSkillGroup[] = [];

  for (const group of groups) {
    const refs: string[] = [];
    for (const ref of group.refs) {
      if (!known.has(ref)) {
        issues.push({ code: "G7", ref });
        continue;
      }
      refs.push(ref);
    }
    if (refs.length === 0) continue;
    cleaned.push({ category: group.category, refs });
  }

  return cleaned;
}

function cleanMatches(
  matches: readonly RequirementMatch[],
  analysis: JobAnalysis,
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): RequirementMatch[] {
  const requirementIds = new Set(
    analysis.requirements.map((requirement) => requirement.id),
  );
  const seen = new Set<string>();
  const cleaned: RequirementMatch[] = [];

  for (const match of matches) {
    if (!requirementIds.has(match.requirementId) || seen.has(match.requirementId)) {
      issues.push({ code: "G8", ref: match.requirementId });
      continue;
    }
    seen.add(match.requirementId);
    cleaned.push(cleanEvidence(match, snapshot, issues));
  }

  for (const requirement of analysis.requirements) {
    if (seen.has(requirement.id)) continue;
    cleaned.push({
      requirementId: requirement.id,
      verdict: "missing",
      evidenceRefs: [],
      note: NOT_ASSESSED,
    });
    issues.push({ code: "G9", ref: requirement.id });
  }

  return cleaned;
}

function cleanEvidence(
  match: RequirementMatch,
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): RequirementMatch {
  const known = knownRefs(snapshot);
  const evidenceRefs: string[] = [];
  for (const ref of match.evidenceRefs) {
    if (!known.has(ref)) {
      issues.push({ code: "G10", ref });
      continue;
    }
    evidenceRefs.push(ref);
  }

  const unsupported =
    (match.verdict === "met" || match.verdict === "partial") &&
    evidenceRefs.length === 0;
  if (unsupported && match.evidenceRefs.length === 0) {
    issues.push({ code: "G10", ref: match.requirementId });
  }

  return {
    requirementId: match.requirementId,
    verdict: unsupported ? "missing" : match.verdict,
    evidenceRefs,
    note: match.note,
  };
}

function knownRefs(snapshot: LibrarySnapshot): Set<string> {
  const refs = new Set<string>();
  for (const entry of snapshot.entries) {
    refs.add(entry.ref);
    for (const bullet of entry.bullets) refs.add(bullet.ref);
  }
  for (const skill of snapshot.skills) refs.add(skill.ref);
  return refs;
}

function hasNewNumber(text: string, sources: readonly string[]): boolean {
  const allowed = new Set(sources.flatMap((source) => numberTokens(source)));
  return numberTokens(text).some((token) => !allowed.has(token));
}

function numberTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(NUMBER)) {
    // A successful match always includes the full text. The index check is for strict indexing.
    const raw = match[0];
    if (raw === undefined) continue;
    tokens.push(normalizeToken(raw));
  }
  return tokens;
}

function normalizeToken(raw: string): string {
  const digits = raw.replace(/[^0-9.]/g, "");
  if (raw.includes("$")) return `$${digits}`;
  if (raw.includes("%")) return `${digits}%`;
  return digits;
}
