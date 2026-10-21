/**
 * Prompt text and library snapshot for tailoring.
 * docs/05-AI.md → Library serialization.
 * Pure: the caller supplies `takenAt`. Refs are assigned after sorting.
 */

import { parseResumeDate } from "./dates";
import { ENTRY_KINDS, LibrarySnapshot } from "./schemas";
import type { Library, LibraryEntry } from "./types";

const EN_DASH = "\u2013";
const EM_DASH = "\u2014";
const PRESENT = "Present";

export type SerializedLibrary = {
  text: string;
  snapshot: LibrarySnapshot;
};

type Dated = { sortOrder: number; id: string };

export function serializeLibrary(
  library: Library,
  takenAt: string,
): SerializedLibrary {
  const entries = orderedEntries(library.entries).map((entry, index) => {
    const ref = `E${index + 1}`;
    return {
      ref,
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization,
      location: entry.location,
      startDate: entry.startDate,
      endDate: entry.endDate,
      isCurrent: entry.isCurrent,
      url: entry.url,
      bullets: bySortThenId(entry.bullets).map((bullet, bulletIndex) => ({
        ref: `${ref}.B${bulletIndex + 1}`,
        id: bullet.id,
        text: bullet.text,
      })),
    };
  });

  const skills = bySortThenId(library.skills).map((skill, index) => ({
    ref: `S${index + 1}`,
    id: skill.id,
    name: skill.name,
    category: skill.category,
  }));

  const snapshot = LibrarySnapshot.parse({
    takenAt,
    profile: {
      fullName: library.profile.fullName,
      headline: library.profile.headline,
      email: library.profile.email,
      phone: library.profile.phone,
      location: library.profile.location,
      links: library.profile.links,
      summary: library.profile.summary,
    },
    entries,
    skills,
  });

  return { text: promptText(snapshot), snapshot };
}

function promptText(snapshot: LibrarySnapshot): string {
  const { profile } = snapshot;
  const lines = [
    "PROFILE",
    `Name: ${dash(profile.fullName)} | Headline: ${dash(profile.headline)}`,
    `Default summary: ${dash(profile.summary)}`,
    "",
  ];

  for (const entry of snapshot.entries) {
    lines.push(
      [
        entry.ref,
        entry.kind,
        dash(entry.title),
        dash(entry.organization),
        dash(entry.location),
        dateRange(entry.startDate, entry.endDate, entry.isCurrent),
      ].join(" | "),
    );
    for (const bullet of entry.bullets) {
      lines.push(`  ${bullet.ref}: ${oneLine(bullet.text)}`);
    }
  }

  lines.push("SKILLS");
  for (const skill of snapshot.skills) {
    lines.push(skillLine(skill));
  }

  return lines.join("\n");
}

/** Prompt text for a snapshot that already has refs. The eval harness uses this. */
export function libraryPromptText(snapshot: LibrarySnapshot): string {
  return promptText(snapshot);
}

function skillLine(skill: {
  ref: string;
  name: string;
  category: string | null;
}): string {
  const name = oneLine(skill.name);
  const category = skill.category === null ? "" : oneLine(skill.category);
  if (category.length === 0) return `  ${skill.ref}: ${name}`;
  return `  ${skill.ref}: ${name} (${category})`;
}

/** Newest first inside one kind. A missing month is December on an end, January on a start. */
function orderedEntries(entries: LibraryEntry[]): LibraryEntry[] {
  const grouped = new Map<LibraryEntry["kind"], LibraryEntry[]>();
  for (const kind of ENTRY_KINDS) grouped.set(kind, []);
  for (const entry of entries) grouped.get(entry.kind)?.push(entry);

  const ordered: LibraryEntry[] = [];
  for (const kind of ENTRY_KINDS) {
    const group = grouped.get(kind);
    if (!group) continue;
    group.sort(compareEntries);
    ordered.push(...group);
  }
  return ordered;
}

function compareEntries(a: LibraryEntry, b: LibraryEntry): number {
  if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
  const byEnd = compareDateDesc(a.endDate, b.endDate, "end");
  if (byEnd !== 0) return byEnd;
  const byStart = compareDateDesc(a.startDate, b.startDate, "start");
  if (byStart !== 0) return byStart;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id.localeCompare(b.id);
}

function compareDateDesc(
  a: string | null,
  b: string | null,
  edge: "start" | "end",
): number {
  const rankA = dateRank(a, edge);
  const rankB = dateRank(b, edge);
  if (rankA === null && rankB === null) return 0;
  if (rankA === null) return 1;
  if (rankB === null) return -1;
  return rankB - rankA;
}

/** Null when missing or not YYYY / YYYY-MM. Year-only end ranks as December; start as January. */
function dateRank(value: string | null, edge: "start" | "end"): number | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) return null;
  const parsed = parseResumeDate(trimmed);
  if (!parsed) return null;
  const month = parsed.month ?? (edge === "end" ? 12 : 1);
  return parsed.year * 12 + month;
}

function dateRange(
  start: string | null,
  end: string | null,
  isCurrent: boolean,
): string {
  const startLabel = cleanDate(start);
  const endLabel = isCurrent ? PRESENT : cleanDate(end);
  if (startLabel && endLabel) return `${startLabel} ${EN_DASH} ${endLabel}`;
  if (!startLabel && endLabel && !isCurrent) return `${EN_DASH} ${endLabel}`;
  return startLabel ?? endLabel ?? EM_DASH;
}

function bySortThenId<T extends Dated>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

/** Newlines become one space so each record stays on one prompt line. */
function oneLine(value: string): string {
  return value.replace(/[^\S\n]*[\r\n]+[^\S\n]*/g, " ").trim();
}

function dash(value: string | null): string {
  if (value === null) return EM_DASH;
  const line = oneLine(value);
  return line.length === 0 ? EM_DASH : line;
}

function cleanDate(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
