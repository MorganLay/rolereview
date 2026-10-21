/**
 * Editable resume content for the workspace.
 * Titles, employers, and dates stay on the snapshot (D-14).
 * docs/02-USER-FLOWS.md → Resume workspace. docs/04-DATA-MODEL.md → ResumeContent.
 */

import type { Requirement } from "@/features/jobs/schemas";
import { ENTRY_KINDS, type LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeTemplateId } from "@/lib/pdf/template";

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

  for (const kind of ENTRY_KINDS) {
    for (const storedEntry of input.stored.entries) {
      const snapshotEntry = snapshotEntries.get(storedEntry.ref);
      if (!snapshotEntry || snapshotEntry.kind !== kind) continue;
      const incomingEntry = incomingEntries.get(storedEntry.ref);
      if (!incomingEntry) return { ok: false, issue: "entries" };
      const built = buildEntry(
        storedEntry,
        incomingEntry,
        snapshotEntry,
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

function buildEntry(
  storedEntry: ContentEntry,
  incomingEntry: ContentEntry,
  snapshotEntry: SnapshotEntry,
  ai: Map<string, Map<string, AiBullet>>,
  hasAiOutput: boolean,
): { ok: true; entry: ContentEntry } | { ok: false; issue: ResumeEditIssue } {
  const storedBullets = new Map<string, ContentBullet>();
  for (const bullet of storedEntry.bullets) {
    if (storedBullets.has(bullet.id)) return { ok: false, issue: "bullets" };
    storedBullets.set(bullet.id, bullet);
  }
  if (incomingEntry.bullets.length !== storedBullets.size) {
    return { ok: false, issue: "bullets" };
  }

  const seen = new Set<string>();
  const bullets: ContentBullet[] = [];
  for (const incoming of incomingEntry.bullets) {
    const stored = storedBullets.get(incoming.id);
    if (!stored || seen.has(incoming.id)) return { ok: false, issue: "bullets" };
    seen.add(incoming.id);

    const text = incoming.text.trim();
    if (text.length === 0 || text.length > RESUME_LIMITS.bullet) {
      return { ok: false, issue: "bulletText" };
    }

    const sourceRefs = stored.sourceRefs;
    const firstRef = sourceRefs[0];
    const originalBullet = firstRef
      ? snapshotEntry.bullets.find((bullet) => bullet.ref === firstRef)
      : undefined;
    if (!originalBullet) return { ok: false, issue: "sources" };

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
      reverted,
      edited: text !== baseline,
    });
  }

  return {
    ok: true,
    entry: {
      ref: snapshotEntry.ref,
      kind: snapshotEntry.kind,
      included: incomingEntry.included,
      bullets,
    },
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

function categoryKey(category: string | null): string {
  return category === null ? "\0" : category;
}

function clipLine(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > RESUME_LIMITS.bullet
    ? trimmed.slice(0, RESUME_LIMITS.bullet)
    : trimmed;
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
