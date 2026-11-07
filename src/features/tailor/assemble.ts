/**
 * Turns a guarded tailor result into the editable resume.
 * docs/05-AI.md → Assembling the editable resume.
 * Titles, employers, and dates stay on the snapshot (D-14).
 */

import { nanoid } from "nanoid";

import { strings } from "@/copy/strings";
import { ENTRY_KINDS, type LibrarySnapshot } from "@/features/library/schemas";

import { sameWording } from "./grounding";
import { RESUME_LIMITS, ResumeContent } from "./schemas";
import type {
  ContentBullet,
  ContentEntry,
  ResumeContent as ResumeContentData,
  TailorSkillGroup,
  ValidatedBullet,
  ValidatedTailorOutput,
} from "./schemas";

type SnapshotEntry = LibrarySnapshot["entries"][number];
type EntryKind = SnapshotEntry["kind"];
type Selected = {
  validated: ValidatedTailorOutput["entries"][number];
  snapshot: SnapshotEntry;
};

export function assembleResumeContent(
  validated: ValidatedTailorOutput,
  snapshot: LibrarySnapshot,
  createId: () => string = nanoid,
): ResumeContentData {
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  const selectedRefs = new Set<string>();
  const selectedByKind: Record<EntryKind, Selected[]> = {
    EXPERIENCE: [],
    PROJECT: [],
    EDUCATION: [],
    CERTIFICATION: [],
    VOLUNTEER: [],
    OTHER: [],
  };

  for (const entry of validated.entries) {
    if (selectedRefs.has(entry.ref)) continue;
    const snapshotEntry = byRef.get(entry.ref);
    if (!snapshotEntry) continue;
    selectedRefs.add(entry.ref);
    selectedByKind[snapshotEntry.kind].push({
      validated: entry,
      snapshot: snapshotEntry,
    });
  }

  const entries: ContentEntry[] = [];
  for (const kind of ENTRY_KINDS) {
    for (const selected of selectedByKind[kind]) {
      entries.push(selectedEntry(selected, createId));
    }
    for (const snapshotEntry of snapshot.entries) {
      if (snapshotEntry.kind !== kind || selectedRefs.has(snapshotEntry.ref)) {
        continue;
      }
      entries.push(unselectedEntry(snapshotEntry, createId));
    }
  }

  return ResumeContent.parse({
    schemaVersion: 1,
    summary: {
      text: clip(validated.summary, RESUME_LIMITS.summary),
      included: true,
    },
    entries,
    skills: skillGroups(validated.skills, snapshot),
  });
}

function selectedEntry(selected: Selected, createId: () => string): ContentEntry {
  const chosen = new Set<string>();
  const bullets: ContentBullet[] = [];

  const sourceText = new Map(
    selected.snapshot.bullets.map((bullet) => [bullet.ref, bullet.text]),
  );
  for (const bullet of selected.validated.bullets) {
    for (const ref of bullet.sourceRefs) chosen.add(ref);
    bullets.push(contentBullet(bullet, sourceText, createId));
  }

  for (const original of selected.snapshot.bullets) {
    if (chosen.has(original.ref)) continue;
    bullets.push(libraryBullet(original.text, [original.ref], false, createId));
  }

  return {
    ref: selected.snapshot.ref,
    kind: selected.snapshot.kind,
    included: true,
    bullets,
  };
}

function contentBullet(
  bullet: ValidatedBullet,
  sourceText: ReadonlyMap<string, string>,
  createId: () => string,
): ContentBullet {
  const text = clip(bullet.text, RESUME_LIMITS.bullet);
  const first = bullet.sourceRefs[0];
  const original = first ? sourceText.get(first) ?? text : text;
  const originalText = clip(original, RESUME_LIMITS.bullet);
  const changed = !bullet.reverted && !sameWording(text, originalText);
  return {
    id: createId(),
    text,
    included: true,
    sourceRefs: bullet.sourceRefs,
    reverted: bullet.reverted,
    edited: false,
    originalText,
    suggestion: changed ? text : null,
    suggestionNote: changed ? rewriteNote(bullet.sourceRefs.length) : null,
  };
}

function libraryBullet(
  text: string,
  sourceRefs: string[],
  included: boolean,
  createId: () => string,
): ContentBullet {
  const originalText = clip(text, RESUME_LIMITS.bullet);
  return {
    id: createId(),
    text: originalText,
    included,
    sourceRefs,
    reverted: false,
    edited: false,
    originalText,
    suggestion: null,
    suggestionNote: null,
  };
}

function rewriteNote(sources: number): string {
  return sources > 1
    ? strings.jobs.workspace.rewriteMerged
    : strings.jobs.workspace.rewriteNote;
}

function unselectedEntry(
  snapshotEntry: SnapshotEntry,
  createId: () => string,
): ContentEntry {
  return {
    ref: snapshotEntry.ref,
    kind: snapshotEntry.kind,
    included: false,
    bullets: snapshotEntry.bullets.map((bullet) =>
      libraryBullet(bullet.text, [bullet.ref], false, createId),
    ),
  };
}

function skillGroups(
  groups: readonly TailorSkillGroup[],
  snapshot: LibrarySnapshot,
): ResumeContentData["skills"] {
  const names = new Map(snapshot.skills.map((skill) => [skill.ref, skill.name]));
  const skills: ResumeContentData["skills"] = [];

  for (const group of groups) {
    const seen = new Set<string>();
    const resolved: string[] = [];
    for (const ref of group.refs) {
      if (seen.has(ref)) continue;
      const name = names.get(ref);
      if (name === undefined) continue;
      seen.add(ref);
      resolved.push(name);
    }
    if (resolved.length === 0) continue;
    skills.push({ category: group.category, names: resolved });
  }

  return skills;
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}
