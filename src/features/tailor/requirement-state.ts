/**
 * Live requirement states for the match panel.
 * docs/05-AI.md → Requirement states.
 * The stored verdict is an input. The state follows the resume on screen.
 */

import type { Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";

import { resumeSkills } from "./content";
import {
  includedResumeText,
  normalizeMatchText,
  termAppears,
} from "./keywords";
import { NOT_ASSESSED_NOTE } from "./schemas";
import type { ResumeContent, StoredVerdict } from "./schemas";

export const REQUIREMENT_STATES = [
  "in_resume",
  "in_library",
  "needs_review",
  "no_evidence",
] as const;

export type RequirementStateName = (typeof REQUIREMENT_STATES)[number];

export type StoredRequirement = {
  verdict: StoredVerdict;
  evidenceRefs: readonly string[];
  note: string;
};

export type RequirementPlacement = {
  state: RequirementStateName;
  /** Excluded bullets, entries, and skills Include turns on. */
  includeRefs: string[];
};

type Place = "included" | "excluded";

export function requirementState(input: {
  requirement: Requirement;
  verdict: StoredRequirement | null;
  content: ResumeContent;
  snapshot: LibrarySnapshot;
  keywords: readonly string[];
}): RequirementPlacement {
  const included = normalizeMatchText(
    includedResumeText(input.content, input.snapshot),
  );
  const includeRefs: string[] = [];
  let inResume = false;

  for (const ref of input.verdict?.evidenceRefs ?? []) {
    const place = placeRef(ref, input.content, input.snapshot);
    if (place === "included") inResume = true;
    else if (place === "excluded") pushRef(includeRefs, ref);
  }

  for (const term of keyTerms(input.requirement.text, input.snapshot, input.keywords)) {
    const needle = normalizeMatchText(term);
    if (termAppears(included, needle)) {
      inResume = true;
      continue;
    }
    for (const ref of excludedRefsForTerm(needle, input.content, input.snapshot)) {
      pushRef(includeRefs, ref);
    }
  }

  if (inResume) return { state: "in_resume", includeRefs: [] };
  if (includeRefs.length > 0) return { state: "in_library", includeRefs };

  const verdict = effectiveVerdict(input.verdict);
  if (verdict === "unassessed" || verdict === "partial") {
    return { state: "needs_review", includeRefs: [] };
  }
  return { state: "no_evidence", includeRefs: [] };
}

/** Turn excluded evidence back on in the resume already on screen. */
export function includeEvidence(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  refs: readonly string[],
): ResumeContent {
  if (refs.length === 0) return content;
  const wanted = new Set(refs);
  let changed = false;

  const entries = content.entries.map((entry) => {
    let turnedBullet = false;
    const bullets = entry.bullets.map((bullet) => {
      if (!bullet.sourceRefs.some((ref) => wanted.has(ref)) || bullet.included) {
        return bullet;
      }
      turnedBullet = true;
      changed = true;
      return { ...bullet, included: true };
    });
    if ((wanted.has(entry.ref) || turnedBullet) && !entry.included) {
      changed = true;
      return { ...entry, included: true, bullets };
    }
    if (turnedBullet) return { ...entry, bullets };
    return entry;
  });

  const names = content.skills.flatMap((group) => group.names);
  const seen = new Set(names);
  for (const skill of snapshot.skills) {
    if (!wanted.has(skill.ref) || seen.has(skill.name)) continue;
    seen.add(skill.name);
    names.push(skill.name);
    changed = true;
  }

  if (!changed) return content;
  return {
    ...content,
    entries,
    skills: resumeSkills(snapshot, names) ?? content.skills,
  };
}

function effectiveVerdict(verdict: StoredRequirement | null): StoredVerdict {
  if (!verdict) return "unassessed";
  if (verdict.verdict === "missing" && verdict.note === NOT_ASSESSED_NOTE) {
    return "unassessed";
  }
  return verdict.verdict;
}

function keyTerms(
  requirementText: string,
  snapshot: LibrarySnapshot,
  keywords: readonly string[],
): string[] {
  const haystack = normalizeMatchText(requirementText);
  const seen = new Set<string>();
  const terms: string[] = [];
  const candidates = [
    ...snapshot.skills.map((skill) => skill.name),
    ...keywords,
  ];
  for (const candidate of candidates) {
    const needle = normalizeMatchText(candidate);
    if (needle.length === 0 || seen.has(needle)) continue;
    if (!termAppears(haystack, needle)) continue;
    seen.add(needle);
    terms.push(candidate);
  }
  return terms;
}

function placeRef(
  ref: string,
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): Place | null {
  const skill = snapshot.skills.find((item) => item.ref === ref);
  if (skill) return skillOnResume(content, skill.name) ? "included" : "excluded";

  for (const entry of snapshot.entries) {
    const bullet = entry.bullets.find((item) => item.ref === ref);
    if (!bullet) continue;
    return bulletOnResume(content, entry.ref, bullet.ref) ? "included" : "excluded";
  }

  const entry = snapshot.entries.find((item) => item.ref === ref);
  if (!entry) return null;
  return entryOnResume(content, entry.ref) ? "included" : "excluded";
}

function excludedRefsForTerm(
  needle: string,
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): string[] {
  const refs: string[] = [];
  for (const entry of snapshot.entries) {
    const contentEntry = content.entries.find((item) => item.ref === entry.ref);
    if (!entryOnResume(content, entry.ref)) {
      if (termAppears(normalizeMatchText(entry.title), needle)) pushRef(refs, entry.ref);
      if (
        entry.organization &&
        termAppears(normalizeMatchText(entry.organization), needle)
      ) {
        pushRef(refs, entry.ref);
      }
    }
    for (const bullet of entry.bullets) {
      if (bulletOnResume(content, entry.ref, bullet.ref)) continue;
      const contentBullet = contentEntry?.bullets.find((item) =>
        item.sourceRefs.includes(bullet.ref),
      );
      const text = contentBullet?.text ?? bullet.text;
      if (
        termAppears(normalizeMatchText(text), needle) ||
        termAppears(normalizeMatchText(bullet.text), needle)
      ) {
        pushRef(refs, bullet.ref);
      }
    }
  }
  for (const skill of snapshot.skills) {
    if (skillOnResume(content, skill.name)) continue;
    if (termAppears(normalizeMatchText(skill.name), needle)) pushRef(refs, skill.ref);
  }
  return refs;
}

function entryOnResume(content: ResumeContent, ref: string): boolean {
  return content.entries.some((entry) => entry.ref === ref && entry.included);
}

function bulletOnResume(content: ResumeContent, entryRef: string, bulletRef: string): boolean {
  const entry = content.entries.find((item) => item.ref === entryRef);
  if (!entry?.included) return false;
  return entry.bullets.some(
    (bullet) => bullet.included && bullet.sourceRefs.includes(bulletRef),
  );
}

function skillOnResume(content: ResumeContent, name: string): boolean {
  return content.skills.some((group) => group.names.includes(name));
}

function pushRef(refs: string[], ref: string) {
  if (!refs.includes(ref)) refs.push(ref);
}
