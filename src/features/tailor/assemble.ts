/**
 * Turns a guarded tailor result into the editable resume.
 * docs/05-AI.md → Assembling the editable resume.
 * Titles and dates come from the snapshot unless this version stores a resolved display heading.
 */

import { nanoid } from "nanoid";

import type { LibrarySnapshot } from "@/features/library/schemas";

import type { Composition } from "./compose";
import { sameWording } from "./grounding";
import { groupMembers } from "./stints";
import { specificReason } from "./review";
import { resumeSectionOrder } from "./resume-shape";
import { RESUME_LIMITS, ResumeContent } from "./schemas";
import type { BulletNote } from "./variants";
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
  notes: ReadonlyMap<string, BulletNote> = new Map(),
  composition?: Composition,
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
  for (const kind of resumeSectionOrder(composition?.sectionOrder)) {
    for (const selected of selectedByKind[kind]) {
      entries.push(selectedEntry(selected, snapshot, createId, notes, composition));
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
    ...(composition
      ? {
          sectionOrder: composition.sectionOrder,
          contacts: composition.contacts,
          review: composition.review,
          headline: composition.headline,
          pageLimit: composition.pageLimit,
        }
      : {}),
    ...(validated.plan ? { plan: validated.plan } : {}),
  });
}

function selectedEntry(
  selected: Selected,
  snapshot: LibrarySnapshot,
  createId: () => string,
  notes: ReadonlyMap<string, BulletNote>,
  composition: Composition | undefined,
): ContentEntry {
  const chosen = new Set<string>();
  const bullets: ContentBullet[] = [];
  const members = new Set(memberRefs(snapshot, selected.snapshot.ref, composition));
  const sourceText = new Map<string, string>();
  const sourceId = new Map<string, string>();
  for (const entry of snapshot.entries) {
    if (!members.has(entry.ref)) continue;
    for (const bullet of entry.bullets) {
      sourceText.set(bullet.ref, bullet.text);
      sourceId.set(bullet.ref, bullet.id);
    }
  }
  for (const bullet of selected.validated.bullets) {
    if (bullet.sourceRefs.length === 0) continue;
    for (const ref of bullet.sourceRefs) chosen.add(ref);
    const note = notes.get(sourceKey(bullet.sourceRefs)) ?? null;
    bullets.push(contentBullet(bullet, sourceText, sourceId, createId, note));
  }

  for (const original of selected.snapshot.bullets) {
    if (chosen.has(original.ref)) continue;
    bullets.push(libraryBullet(original.text, [original.ref], false, createId, [original.id]));
  }

  const display = composition?.presentation[selected.snapshot.ref];
  const stint = composition?.stints.find((item) => item.members.includes(selected.snapshot.ref));
  const evidenceEntryRefs = stint?.members.filter((ref) => ref !== selected.snapshot.ref) ?? [];
  return {
    ref: selected.snapshot.ref,
    kind: selected.snapshot.kind,
    included: true,
    entryId: selected.snapshot.id,
    ...(display
      ? {
          displayTitle: display.displayTitle,
          displayOrganization: display.displayOrganization,
          displayStart: display.displayStart,
          displayEnd: display.displayEnd,
          displayCurrent: display.displayCurrent,
        }
      : {}),
    ...(evidenceEntryRefs.length > 0 ? { evidenceEntryRefs } : {}),
    bullets,
  };
}

function contentBullet(
  bullet: ValidatedBullet,
  sourceText: ReadonlyMap<string, string>,
  sourceId: ReadonlyMap<string, string>,
  createId: () => string,
  note: BulletNote | null = null,
): ContentBullet {
  const text = clip(bullet.text, RESUME_LIMITS.bullet);
  const original = bullet.sourceRefs
    .map((ref) => sourceText.get(ref))
    .filter((item): item is string => item !== undefined)
    .join(" ");
  const originalText = clip(original.length > 0 ? original : text, RESUME_LIMITS.bullet);
  const changed = !bullet.reverted && !sameWording(text, originalText);
  const why = specificReason(note?.why);
  const what = specificReason(note?.what);
  return {
    id: createId(),
    text,
    included: true,
    sourceRefs: bullet.sourceRefs,
    sourceIds: idsFor(bullet.sourceRefs, sourceId),
    reverted: bullet.reverted,
    edited: false,
    originalText,
    suggestion: changed ? text : null,
    suggestionNote: changed ? why : null,
    changeWhat: changed ? what : null,
    requirementIds: changed ? (note?.requirementIds ?? []).slice(0, 8) : [],
  };
}

function libraryBullet(
  text: string,
  sourceRefs: string[],
  included: boolean,
  createId: () => string,
  sourceIds: string[] = [],
): ContentBullet {
  const originalText = clip(text, RESUME_LIMITS.bullet);
  return {
    id: createId(),
    text: originalText,
    included,
    sourceRefs,
    sourceIds,
    reverted: false,
    edited: false,
    originalText,
    suggestion: null,
    suggestionNote: null,
    changeWhat: null,
    requirementIds: [],
  };
}

function memberRefs(
  snapshot: LibrarySnapshot,
  ref: string,
  composition: Composition | undefined,
): string[] {
  const stint = composition?.stints.find((item) => item.members.includes(ref));
  if (stint) return stint.members;
  return groupMembers(snapshot.entries, snapshot.takenAt, ref);
}

function sourceKey(refs: readonly string[]): string {
  return [...refs].sort().join("\0");
}

function idsFor(
  refs: readonly string[],
  sourceId: ReadonlyMap<string, string>,
): string[] {
  const ids: string[] = [];
  for (const ref of refs) {
    const id = sourceId.get(ref);
    if (id) ids.push(id);
  }
  return ids;
}

function unselectedEntry(
  snapshotEntry: SnapshotEntry,
  createId: () => string,
): ContentEntry {
  return {
    ref: snapshotEntry.ref,
    kind: snapshotEntry.kind,
    included: false,
    entryId: snapshotEntry.id,
    bullets: snapshotEntry.bullets.map((bullet) =>
      libraryBullet(bullet.text, [bullet.ref], false, createId, [bullet.id]),
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
