/**
 * Fabrication guard for a tailored resume.
 * docs/05-AI.md → The fabrication guard.
 * Pure: G1–G12 clean the model output before anything is saved.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { hasUnsupportedNumber } from "@/lib/ai/numbers";

import { NOT_ASSESSED_NOTE, RESUME_LIMITS } from "./schemas";
import type {
  GuardRequirementMatch,
  RequirementMatch,
  TailorBullet,
  TailorOutput,
  TailorSkillGroup,
  ValidatedBullet,
  ValidatedTailorOutput,
} from "./schemas";
import {
  hasOverstatedTenure,
  libraryNumberSources,
  snapshotTenure,
  stripEducationDurationPhrases,
} from "./tenure";

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
  "G12",
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

type SnapshotEntry = LibrarySnapshot["entries"][number];

export function validateTailorOutput(
  output: TailorOutput,
  snapshot: LibrarySnapshot,
  analysis: JobAnalysis,
): GuardResult {
  const issues: GuardIssue[] = [];
  const entries = cleanEntries(output.entries, snapshot, issues);
  const skills = cleanSkills(output.skills, snapshot, issues);
  const requirementMatches = cleanMatches(
    output.requirementMatches,
    analysis,
    snapshot,
    issues,
  );
  const summary = cleanSummary(output.summary, snapshot, issues);
  return {
    output: {
      summary: summary.text,
      entries: entries.entries,
      skills,
      requirementMatches,
    },
    reverts: entries.reverts + summary.reverts,
    issues,
  };
}

function cleanSummary(
  text: string,
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): { text: string; reverts: number } {
  const tenure = snapshotTenure(snapshot);
  const sources = libraryNumberSources(snapshot, tenure);
  const parts = sentences(text);
  if (parts.length === 0) return { text, reverts: 0 };

  const kept: string[] = [];
  let dropped = false;
  for (const sentence of parts) {
    const forNumbers = stripEducationDurationPhrases(sentence);
    if (
      hasOverstatedTenure(sentence, tenure) ||
      hasUnsupportedNumber(forNumbers, sources)
    ) {
      dropped = true;
      continue;
    }
    kept.push(sentence);
  }

  if (!dropped) return { text, reverts: 0 };
  issues.push({ code: "G12", ref: "summary" });
  if (kept.length > 0) return { text: kept.join(" "), reverts: 1 };
  return { text: snapshot.profile.summary?.trim() ?? "", reverts: 1 };
}

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "e.g",
  "i.e",
]);

function sentences(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!isSentenceEnd(text, index)) continue;
    const sentence = text.slice(start, index + 1).trim();
    if (sentence.length > 0) parts.push(sentence);
    let next = index + 1;
    while (next < text.length && /\s/.test(text[next] ?? "")) next += 1;
    start = next;
    index = next - 1;
  }
  const tail = text.slice(start).trim();
  if (tail.length > 0) parts.push(tail);
  return parts;
}

function isSentenceEnd(text: string, index: number): boolean {
  const mark = text[index];
  if (mark !== "." && mark !== "!" && mark !== "?") return false;
  const next = text[index + 1];
  if (next !== undefined && !/\s/.test(next)) return false;
  if (mark === "." && abbreviationBefore(text, index)) return false;
  return true;
}

function abbreviationBefore(text: string, periodIndex: number): boolean {
  const match = text.slice(0, periodIndex).match(/(?:[A-Za-z]\.)*[A-Za-z]+$/);
  const token = match?.[0];
  if (token === undefined) return false;
  return ABBREVIATIONS.has(token.toLowerCase());
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
    if (hasUnsupportedNumber(text, sources.map((source) => source.text))) {
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
): GuardRequirementMatch[] {
  const requirementIds = new Set(
    analysis.requirements.map((requirement) => requirement.id),
  );
  const seen = new Set<string>();
  const cleaned: GuardRequirementMatch[] = [];

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
      verdict: "unassessed",
      evidenceRefs: [],
      note: NOT_ASSESSED_NOTE,
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
