/**
 * Editable resume content for the workspace.
 * Titles, employers, and dates stay on the snapshot (D-14).
 * docs/02-USER-FLOWS.md → Resume workspace. docs/04-DATA-MODEL.md → ResumeContent.
 */

import { nanoid } from "nanoid";

import type { Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeTemplateId } from "@/lib/pdf/template";

import { sameWording } from "./grounding";
import { groupMembers, libraryBulletInGroup } from "./stints";
import { resumeSectionOrder } from "./resume-shape";
import {
  RESUME_LIMITS,
  type ContentBullet,
  type ContentEntry,
  type MatchReport,
  type ResumeContent,
  type ValidatedTailorOutput,
} from "./schemas";

export type ResumeEditIssue =
  | "entries"
  | "bullets"
  | "bulletText"
  | "summary"
  | "skills"
  | "sources";

export type ResumeEditResult =
  | { ok: true; content: ResumeContent }
  | { ok: false; issue: ResumeEditIssue };

/** Which Pro export options this plan can use. */
export type ResumeTemplateAccess = {
  modern: boolean;
  compact: boolean;
  docx: boolean;
};

/** A current library entry the quick-add dialog can attach a bullet to. */
export type LibraryEntryOption = {
  id: string;
  title: string;
  organization: string | null;
  kind: LibrarySnapshot["entries"][number]["kind"];
};

export type ResumeWorkspaceData = {
  jobId: string;
  jobTitle: string;
  company: string;
  resumeId: string;
  version: number;
  savedAt: string;
  timeZone: string;
  content: ResumeContent;
  snapshot: LibrarySnapshot;
  /** Stored library match. Editing the resume does not change it. */
  match: MatchReport;
  requirements: Requirement[];
  keywords: string[];
  libraryEntries: LibraryEntryOption[];
  templateId: ResumeTemplateId;
  /** This resume is Job.submittedResumeId. */
  submitted: boolean;
  /** Saved version name. Blank uses the company and date. */
  label: string | null;
  /** label, or "{Company} — {date}". */
  title: string;
  /** submittedAt is set. Content and template cannot change. */
  frozen: boolean;
  /** Calendar date of submittedAt, when this version is frozen. */
  submittedOn: string | null;
  /** Current job status. The Applied prompt is only offered from SAVED. */
  jobStatus: string;
  templates: ResumeTemplateAccess;
};

type SnapshotEntry = LibrarySnapshot["entries"][number];
type AiBullet = { text: string; reverted: boolean };

/** "10:42" in the user's timezone. */
export function formatSavedTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = formatClock(date, timeZone) ?? formatClock(date, "UTC");
  return formatted ?? "";
}

/**
 * Canonical resume after an edit.
 * Entry order follows section order, and within a section the tailored order.
 * Bullet ids, their entry, and source refs stay as stored.
 */
/**
 * Restore a combined bullet as its library sources.
 * Each source becomes its own bullet, in library order, with that source's wording.
 */
export function restoreSourceBullets(
  content: ResumeContent,
  entryRef: string,
  bulletId: string,
  snapshot: LibrarySnapshot,
  createId: () => string = nanoid,
): ResumeContent {
  const snapshotEntry = snapshot.entries.find((entry) => entry.ref === entryRef);
  if (!snapshotEntry) return content;
  return {
    ...content,
    entries: content.entries.map((entry) => {
      if (entry.ref !== entryRef) return entry;
      const index = entry.bullets.findIndex((bullet) => bullet.id === bulletId);
      const bullet = entry.bullets[index];
      if (!bullet) return entry;
      const members = new Set(groupMembers(snapshot.entries, snapshot.takenAt, entryRef));
      const ordered = snapshot.entries
        .filter((item) => members.has(item.ref))
        .flatMap((item) => item.bullets)
        .filter((source) => bullet.sourceRefs.includes(source.ref));
      if (ordered.length <= 1) {
        const text = clipLine(ordered[0]?.text ?? bullet.originalText ?? bullet.text);
        return {
          ...entry,
          bullets: entry.bullets.map((item) =>
            item.id === bulletId ? { ...item, text } : item,
          ),
        };
      }
      const already = new Set(
        entry.bullets
          .filter((item) => item.id !== bulletId && item.sourceRefs.length === 1)
          .map((item) => item.sourceRefs[0]),
      );
      const created = ordered
        .filter((source) => !already.has(source.ref))
        .map((source) => libraryBullet(source, bullet.included, createId));
      return {
        ...entry,
        bullets: [
          ...entry.bullets.slice(0, index),
          ...created,
          ...entry.bullets.slice(index + 1),
        ],
      };
    }),
  };
}

function libraryBullet(
  source: SnapshotEntry["bullets"][number],
  included: boolean,
  createId: () => string,
): ContentBullet {
  const text = clipLine(source.text);
  return {
    id: createId(),
    text,
    included,
    sourceRefs: [source.ref],
    sourceIds: [source.id],
    reverted: true,
    edited: false,
    originalText: text,
    suggestion: null,
    suggestionNote: null,
    changeWhat: null,
    requirementIds: [],
  };
}

export function applyResumeEdit(input: {
  stored: ResumeContent;
  incoming: ResumeContent;
  snapshot: LibrarySnapshot;
  aiOutput: ValidatedTailorOutput | null;
}): ResumeEditResult {
  const snapshotEntries = indexEntries(input.snapshot);
  if (!snapshotEntries) return { ok: false, issue: "entries" };

  const storedEntries = indexContent(input.stored.entries);
  const incomingEntries = indexContent(input.incoming.entries);
  if (!storedEntries || !incomingEntries) return { ok: false, issue: "entries" };
  if (!sameKeys(snapshotEntries, storedEntries) || !sameKeys(snapshotEntries, incomingEntries)) {
    return { ok: false, issue: "entries" };
  }

  const summary = input.incoming.summary.text.trim();
  if (summary.length > RESUME_LIMITS.summary) return { ok: false, issue: "summary" };

  const ai = indexAi(input.aiOutput);
  const entries: ContentEntry[] = [];

  for (const kind of resumeSectionOrder(input.stored.sectionOrder)) {
    for (const storedEntry of input.stored.entries) {
      const snapshotEntry = snapshotEntries.get(storedEntry.ref);
      if (!snapshotEntry || snapshotEntry.kind !== kind) continue;
      const incomingEntry = incomingEntries.get(storedEntry.ref);
      if (!incomingEntry) return { ok: false, issue: "entries" };
      const built = buildEntry(
        storedEntry,
        incomingEntry,
        snapshotEntry,
        input.snapshot,
        ai,
        input.aiOutput !== null,
      );
      if (!built.ok) return built;
      entries.push(built.entry);
    }
  }

  const names: string[] = [];
  for (const group of input.incoming.skills) names.push(...group.names);
  const skills = resumeSkills(input.snapshot, names);
  if (!skills) return { ok: false, issue: "skills" };

  return {
    ok: true,
    content: {
      schemaVersion: 1,
      summary: { text: summary, included: input.incoming.summary.included },
      entries,
      skills,
      ...(input.stored.sectionOrder ? { sectionOrder: input.stored.sectionOrder } : {}),
      ...(input.stored.contacts ? { contacts: input.stored.contacts } : {}),
      ...(input.stored.review ? { review: input.stored.review } : {}),
    },
  };
}

/** Skill names on the snapshot, grouped by the snapshot category. */
export function resumeSkills(
  snapshot: LibrarySnapshot,
  names: readonly string[],
): ResumeContent["skills"] | null {
  const categoryByName = new Map<string, string | null>();
  for (const skill of snapshot.skills) {
    if (!categoryByName.has(skill.name)) categoryByName.set(skill.name, skill.category);
  }

  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name) || !categoryByName.has(name)) return null;
    seen.add(name);
  }

  const order: { category: string | null; names: string[] }[] = [];
  const indexByCategory = new Map<string, number>();
  for (const skill of snapshot.skills) {
    const key = categoryKey(skill.category);
    if (indexByCategory.has(key)) continue;
    indexByCategory.set(key, order.length);
    order.push({ category: skill.category, names: [] });
  }

  for (const name of names) {
    const category = categoryByName.get(name) ?? null;
    const key = categoryKey(category);
    let index = indexByCategory.get(key);
    if (index === undefined) {
      index = order.length;
      indexByCategory.set(key, index);
      order.push({ category, names: [] });
    }
    order[index]?.names.push(name);
  }

  return order.filter((group) => group.names.length > 0);
}

function restoredSplit(
  stored: readonly ContentBullet[],
  incoming: readonly ContentBullet[],
  snapshotEntry: SnapshotEntry,
  snapshot: LibrarySnapshot,
): { createdIds: string[] } | null {
  const storedIds = new Set(stored.map((bullet) => bullet.id));
  const incomingIds = new Set(incoming.map((bullet) => bullet.id));
  const removed = stored.filter((bullet) => !incomingIds.has(bullet.id));
  const created = incoming.filter((bullet) => !storedIds.has(bullet.id));
  if (removed.length !== 1 || created.length === 0) return null;
  const source = removed[0];
  if (!source || source.sourceRefs.length < 2) return null;
  for (const bullet of stored) {
    if (bullet.id !== source.id && !incomingIds.has(bullet.id)) return null;
  }
  const expected = new Set(source.sourceRefs);
  const seen = new Set<string>();
  for (const bullet of created) {
    if (bullet.sourceRefs.length !== 1) return null;
    const ref = bullet.sourceRefs[0];
    if (!ref || !expected.has(ref) || seen.has(ref)) return null;
    if (!libraryBulletInGroup(snapshot, snapshotEntry.ref, ref)) return null;
    seen.add(ref);
  }
  for (const ref of expected) {
    const covered =
      seen.has(ref) ||
      incoming.some(
        (bullet) =>
          storedIds.has(bullet.id) &&
          bullet.sourceRefs.length === 1 &&
          bullet.sourceRefs[0] === ref,
      );
    if (!covered) return null;
  }
  return { createdIds: created.map((bullet) => bullet.id) };
}

function restoredBullet(
  incoming: ContentBullet,
  snapshot: LibrarySnapshot,
  entryRef: string,
): ContentBullet | null {
  const ref = incoming.sourceRefs.length === 1 ? incoming.sourceRefs[0] : undefined;
  const library = ref ? libraryBulletInGroup(snapshot, entryRef, ref) : undefined;
  if (!library) return null;
  const text = incoming.text.trim();
  if (text.length === 0 || text.length > RESUME_LIMITS.bullet) return null;
  const original = clipLine(library.text);
  const matches = sameWording(text, original);
  return {
    id: incoming.id,
    text,
    included: incoming.included,
    sourceRefs: [library.ref],
    sourceIds: [library.id],
    reverted: matches,
    edited: !matches,
    originalText: original,
    suggestion: null,
    suggestionNote: null,
    changeWhat: null,
    requirementIds: [],
  };
}

function buildEntry(
  storedEntry: ContentEntry,
  incomingEntry: ContentEntry,
  snapshotEntry: SnapshotEntry,
  snapshot: LibrarySnapshot,
  ai: Map<string, Map<string, AiBullet>>,
  hasAiOutput: boolean,
): { ok: true; entry: ContentEntry } | { ok: false; issue: ResumeEditIssue } {
  const storedBullets = new Map<string, ContentBullet>();
  for (const bullet of storedEntry.bullets) {
    if (storedBullets.has(bullet.id)) return { ok: false, issue: "bullets" };
    storedBullets.set(bullet.id, bullet);
  }
  const split = restoredSplit(storedEntry.bullets, incomingEntry.bullets, snapshotEntry, snapshot);
  if (!split && incomingEntry.bullets.length !== storedBullets.size) {
    return { ok: false, issue: "bullets" };
  }
  const created = new Set(split?.createdIds ?? []);

  const seen = new Set<string>();
  const bullets: ContentBullet[] = [];
  for (const incoming of incomingEntry.bullets) {
    if (seen.has(incoming.id)) return { ok: false, issue: "bullets" };
    seen.add(incoming.id);
    if (created.has(incoming.id)) {
      const text = incoming.text.trim();
      if (text.length === 0 || text.length > RESUME_LIMITS.bullet) {
        return { ok: false, issue: "bulletText" };
      }
      const built = restoredBullet(incoming, snapshot, snapshotEntry.ref);
      if (!built) return { ok: false, issue: "sources" };
      bullets.push(built);
      continue;
    }
    const stored = storedBullets.get(incoming.id);
    if (!stored) return { ok: false, issue: "bullets" };

    const text = incoming.text.trim();
    if (text.length === 0 || text.length > RESUME_LIMITS.bullet) {
      return { ok: false, issue: "bulletText" };
    }

    const sourceRefs = stored.sourceRefs;
    const firstRef = sourceRefs[0];
    const originalBullet = firstRef
      ? libraryBulletInGroup(snapshot, snapshotEntry.ref, firstRef)
      : undefined;
    if (!originalBullet || sourceRefs.some((ref) => !libraryBulletInGroup(snapshot, snapshotEntry.ref, ref))) {
      return { ok: false, issue: "sources" };
    }

    const original = clipLine(originalBullet.text);
    const aiBullet = ai.get(snapshotEntry.ref)?.get(sourceKey(sourceRefs));
    const baseline = aiBullet
      ? clipLine(aiBullet.text)
      : hasAiOutput
        ? original
        : clipLine(stored.text);
    const guardReverted = (aiBullet?.reverted === true || (!aiBullet && !hasAiOutput && stored.reverted)) && text === original;
    const reverted = text === original && (baseline !== original || guardReverted);

    bullets.push({
      id: stored.id,
      text,
      included: incoming.included,
      sourceRefs: [...sourceRefs],
      sourceIds: stored.sourceIds ? [...stored.sourceIds] : undefined,
      reverted,
      edited: text !== baseline,
      originalText: stored.originalText ?? original,
      suggestion: stored.suggestion,
      suggestionNote: stored.suggestionNote,
      changeWhat: stored.changeWhat ?? null,
      requirementIds: stored.requirementIds ? [...stored.requirementIds] : [],
    });
  }

  return {
    ok: true,
    entry: {
      ref: snapshotEntry.ref,
      kind: snapshotEntry.kind,
      included: incomingEntry.included,
      entryId: snapshotEntry.id,
      bullets,
    },
  };
}

/**
 * A new tailor is a new version. Wording the user edited on the previous
 * version is copied onto the same source bullets. Include switches follow
 * the new tailor. The new suggestion stays available beside that wording.
 */
export function preserveUserEdits(
  next: ResumeContent,
  previous: ResumeContent | null,
  previousAi: ValidatedTailorOutput | null,
): ResumeContent {
  if (!previous) return next;
  const edited = new Map<string, ContentBullet>();
  for (const entry of previous.entries) {
    for (const bullet of entry.bullets) {
      if (!bullet.edited) continue;
      edited.set(editKey(entry.ref, bullet), bullet);
    }
  }

  const entries = next.entries.map((entry) => ({
    ...entry,
    bullets: entry.bullets.map((bullet) => {
      const kept = edited.get(editKey(entry.ref, bullet));
      if (!kept) return bullet;
      if (
        kept.originalText &&
        bullet.originalText &&
        !sameWording(kept.originalText, bullet.originalText)
      ) {
        return bullet;
      }
      const text = clipLine(kept.text);
      const original = bullet.originalText ?? kept.originalText;
      return {
        ...bullet,
        text,
        edited: !sameWording(text, bullet.text),
        reverted: original !== null && sameWording(text, original),
      };
    }),
  }));

  return {
    ...next,
    summary: preservedSummary(next.summary, previous, previousAi),
    entries,
  };
}

function preservedSummary(
  next: ResumeContent["summary"],
  previous: ResumeContent,
  previousAi: ValidatedTailorOutput | null,
): ResumeContent["summary"] {
  if (!previousAi) return next;
  const saved = previous.summary.text.trim();
  const generated = clipLine(previousAi.summary, RESUME_LIMITS.summary);
  const textEdited = saved !== generated;
  const excluded = previous.summary.included === false;
  if (!textEdited && !excluded) return next;
  return {
    text: textEdited ? clipLine(saved, RESUME_LIMITS.summary) : next.text,
    included: excluded ? false : next.included,
  };
}

function indexEntries(
  snapshot: LibrarySnapshot,
): Map<string, SnapshotEntry> | null {
  const byRef = new Map<string, SnapshotEntry>();
  for (const entry of snapshot.entries) {
    if (byRef.has(entry.ref)) return null;
    byRef.set(entry.ref, entry);
  }
  return byRef;
}

function indexContent(entries: readonly ContentEntry[]): Map<string, ContentEntry> | null {
  const byRef = new Map<string, ContentEntry>();
  for (const entry of entries) {
    if (byRef.has(entry.ref)) return null;
    byRef.set(entry.ref, entry);
  }
  return byRef;
}

function sameKeys(left: Map<string, unknown>, right: Map<string, unknown>): boolean {
  if (left.size !== right.size) return false;
  for (const key of left.keys()) {
    if (!right.has(key)) return false;
  }
  return true;
}

function indexAi(
  aiOutput: ValidatedTailorOutput | null,
): Map<string, Map<string, AiBullet>> {
  const byEntry = new Map<string, Map<string, AiBullet>>();
  if (!aiOutput) return byEntry;
  for (const entry of aiOutput.entries) {
    let bullets = byEntry.get(entry.ref);
    if (!bullets) {
      bullets = new Map();
      byEntry.set(entry.ref, bullets);
    }
    for (const bullet of entry.bullets) {
      const key = sourceKey(bullet.sourceRefs);
      if (!bullets.has(key)) {
        bullets.set(key, { text: bullet.text, reverted: bullet.reverted });
      }
    }
  }
  return byEntry;
}

function sourceKey(refs: readonly string[]): string {
  return [...refs].sort().join("\0");
}

/** Stable bullet ids when the resume has them. Older resumes keep the ref key. */
function editKey(
  entryRef: string,
  bullet: { sourceRefs: readonly string[]; sourceIds?: readonly string[] },
): string {
  const ids = (bullet.sourceIds ?? []).filter((id) => id.length > 0);
  if (ids.length > 0) return `id\0${[...ids].sort().join("\0")}`;
  return `ref\0${entryRef}\0${sourceKey(bullet.sourceRefs)}`;
}

function categoryKey(category: string | null): string {
  return category === null ? "\0" : category;
}

function clipLine(text: string, max: number = RESUME_LIMITS.bullet): string {
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function formatClock(date: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (!hour || !minute) return null;
    return `${hour}:${minute}`;
  } catch {
    return null;
  }
}
