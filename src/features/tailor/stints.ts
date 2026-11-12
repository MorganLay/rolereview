/**
 * Records that describe one employment stint or one project.
 * The library rows stay separate. Composition may use every member's facts
 * under one heading. Ambiguous pairs stay apart.
 * docs/05-AI.md → Composing the resume.
 */

import { parseResumeDate } from "@/features/library/dates";
import type { LibrarySnapshot } from "@/features/library/schemas";

type SnapshotEntry = LibrarySnapshot["entries"][number];
type SnapshotBullet = SnapshotEntry["bullets"][number];

const TITLE_STOP = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "a",
  "an",
  "of",
  "in",
  "to",
  "at",
]);

const LEVELS = new Set([
  "intern",
  "internship",
  "junior",
  "senior",
  "lead",
  "principal",
  "director",
  "manager",
  "chief",
  "associate",
  "staff",
  "head",
]);

export type ExperienceGroup = {
  canonical: string;
  members: string[];
};

/** Groups of two or more records. A record that is not listed stands alone. */
export function experienceGroups(
  entries: readonly SnapshotEntry[],
  takenAt: string,
  confirmed: readonly (readonly string[])[] = [],
): ExperienceGroup[] {
  const eligible = entries.filter(
    (entry) => entry.kind === "EXPERIENCE" || entry.kind === "PROJECT" || entry.kind === "VOLUNTEER",
  );
  const parent = new Map<string, string>();
  const find = (ref: string): string => {
    const current = parent.get(ref) ?? ref;
    if (current === ref) return ref;
    const root = find(current);
    parent.set(ref, root);
    return root;
  };
  const unite = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  for (let index = 0; index < eligible.length; index += 1) {
    for (let other = index + 1; other < eligible.length; other += 1) {
      const left = eligible[index];
      const right = eligible[other];
      if (!left || !right || !sameExperience(left, right, takenAt)) continue;
      unite(left.ref, right.ref);
    }
  }

  const byRef = new Map(eligible.map((entry) => [entry.ref, entry]));
  for (const members of confirmed) {
    const rows = members
      .map((ref) => byRef.get(ref))
      .filter((entry): entry is SnapshotEntry => entry !== undefined);
    const head = rows[0];
    if (!head || rows.length < 2) continue;
    if (!rows.every((row) => recordsCompatible(head, row))) continue;
    for (const row of rows.slice(1)) unite(head.ref, row.ref);
  }

  const buckets = new Map<string, SnapshotEntry[]>();
  for (const entry of eligible) {
    const root = find(entry.ref);
    const list = buckets.get(root) ?? [];
    list.push(entry);
    buckets.set(root, list);
  }

  const groups: ExperienceGroup[] = [];
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const ranked = [...list].sort(canonicalOrder);
    const heading = ranked[0];
    if (!heading) continue;
    groups.push({
      canonical: heading.ref,
      members: list.map((entry) => entry.ref),
    });
  }
  return groups;
}

export function groupMembers(
  entries: readonly SnapshotEntry[],
  takenAt: string,
  ref: string,
  confirmed: readonly (readonly string[])[] = [],
): string[] {
  const group = experienceGroups(entries, takenAt, confirmed).find((item) =>
    item.members.includes(ref),
  );
  return group?.members ?? [ref];
}

export function libraryBulletInGroup(
  snapshot: LibrarySnapshot,
  entryRef: string,
  bulletRef: string,
): SnapshotBullet | undefined {
  const members = new Set(groupMembers(snapshot.entries, snapshot.takenAt, entryRef));
  for (const entry of snapshot.entries) {
    if (!members.has(entry.ref)) continue;
    const bullet = entry.bullets.find((item) => item.ref === bulletRef);
    if (bullet) return bullet;
  }
  return undefined;
}

/** Prompt text. "none" when every record stands alone. */
export function sameRoleText(entries: readonly SnapshotEntry[], takenAt: string): string {
  const groups = experienceGroups(entries, takenAt);
  if (groups.length === 0) return "none";
  return groups
    .map((group) => {
      const rest = group.members.filter((ref) => ref !== group.canonical);
      return `${group.canonical} is the heading for ${rest.join(", ")}`;
    })
    .join("\n");
}

function canonicalOrder(left: SnapshotEntry, right: SnapshotEntry): number {
  const bullets = right.bullets.length - left.bullets.length;
  if (bullets !== 0) return bullets;
  return right.title.trim().length - left.title.trim().length;
}

function sameExperience(left: SnapshotEntry, right: SnapshotEntry, takenAt: string): boolean {
  if (left.kind !== right.kind || left.ref === right.ref) return false;
  if (left.kind === "PROJECT") return sameProject(left, right, takenAt);
  return sameEmployment(left, right, takenAt);
}

function sameEmployment(left: SnapshotEntry, right: SnapshotEntry, takenAt: string): boolean {
  if (!employersMatch(left.organization, right.organization)) return false;
  if (!titlesCompatible(left.title, right.title)) return false;
  return datesAllow(left, right, takenAt, oneSidedLevel(left.title, right.title));
}

/** Same employer, including an acronym of the longer name. A shared word is not enough. */
export function employersMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = orgKey(left);
  const b = orgKey(right);
  if (a.length >= 3 && a === b) return true;
  const leftInitials = initials(left);
  const rightInitials = initials(right);
  if (a.length >= 3 && a.length <= 6 && leftInitials.length === 0 && a === rightInitials) return true;
  if (b.length >= 3 && b.length <= 6 && rightInitials.length === 0 && b === leftInitials) return true;
  return false;
}

function initials(value: string | null | undefined): string {
  const words = (value ?? "")
    .toLowerCase()
    .replace(/\.(com|co|ca|io|org|net|ai)\b/g, " ")
    .replace(/\b(inc|llc|ltd|corp|corporation|company|the|of|and|for)\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
  if (words.length < 2) return "";
  const letters = words.map((word) => word[0] ?? "").join("");
  return letters.length >= 3 ? letters : "";
}

/** A confirmed pair may disagree on dates. A different level or employer stays apart. */
export function recordsCompatible(left: SnapshotEntry, right: SnapshotEntry): boolean {
  if (left.ref === right.ref) return true;
  if (left.kind !== right.kind) return false;
  if (left.kind === "PROJECT") {
    return nearTitle(left.title, right.title) || titlesCompatible(left.title, right.title);
  }
  return employersMatch(left.organization, right.organization) && titlesCompatible(left.title, right.title);
}

function sameProject(left: SnapshotEntry, right: SnapshotEntry, takenAt: string): boolean {
  const orgLeft = orgKey(left.organization);
  const orgRight = orgKey(right.organization);
  if (
    orgLeft.length > 0 &&
    orgRight.length > 0 &&
    orgLeft !== orgRight &&
    !employersMatch(left.organization, right.organization)
  ) {
    return false;
  }
  const near = nearTitle(left.title, right.title);
  const titles = titlesCompatible(left.title, right.title);
  if (!near && !titles) return false;
  const leftSpan = span(left, takenAt);
  const rightSpan = span(right, takenAt);
  if (!leftSpan || !rightSpan) return near;
  if (oneSidedLevel(left.title, right.title)) {
    return leftSpan.start === rightSpan.start && leftSpan.end === rightSpan.end;
  }
  return leftSpan.start <= rightSpan.end && rightSpan.start <= leftSpan.end;
}

function datesAllow(
  left: SnapshotEntry,
  right: SnapshotEntry,
  takenAt: string,
  equalOnly: boolean,
): boolean {
  const leftSpan = span(left, takenAt);
  const rightSpan = span(right, takenAt);
  if (!leftSpan || !rightSpan) return false;
  if (equalOnly) return leftSpan.start === rightSpan.start && leftSpan.end === rightSpan.end;
  return leftSpan.start <= rightSpan.end && rightSpan.start <= leftSpan.end;
}

function oneSidedLevel(leftTitle: string, rightTitle: string): boolean {
  const left = levelOf(leftTitle);
  const right = levelOf(rightTitle);
  return left !== right;
}

function levelOf(title: string): string | null {
  const level = titleTokens(title).find((token) => LEVELS.has(token));
  if (!level) return null;
  if (level === "internship") return "intern";
  return level;
}

function titlesCompatible(leftTitle: string, rightTitle: string): boolean {
  const leftLevel = levelOf(leftTitle);
  const rightLevel = levelOf(rightTitle);
  if (leftLevel && rightLevel && leftLevel !== rightLevel) return false;
  const left = titleTokens(leftTitle).filter((token) => !LEVELS.has(token));
  const right = titleTokens(rightTitle).filter((token) => !LEVELS.has(token));
  if (left.length === 0 || right.length === 0) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let shared = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) shared += 1;
  }
  if (left.length === 1 && right.length === 1) return left[0] === right[0];
  if (shared >= 2) return true;
  const smaller = Math.min(leftSet.size, rightSet.size);
  if (smaller >= 2 && (subset(leftSet, rightSet) || subset(rightSet, leftSet))) return true;
  const union = leftSet.size + rightSet.size - shared;
  return union > 0 && shared / union >= 0.6 && shared >= 1;
}

function nearTitle(leftTitle: string, rightTitle: string): boolean {
  const left = orgKey(leftTitle);
  const right = orgKey(rightTitle);
  if (left.length >= 8 && right.length >= 8 && (left === right || left.startsWith(right) || right.startsWith(left))) {
    return true;
  }
  const leftTokens = titleTokens(leftTitle).filter((token) => !LEVELS.has(token));
  const rightTokens = titleTokens(rightTitle).filter((token) => !LEVELS.has(token));
  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer = new Set(leftTokens.length <= rightTokens.length ? rightTokens : leftTokens);
  if (shorter.length < 3) return false;
  return shorter.every((token) => longer.has(token));
}

function subset(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const token of left) {
    if (!right.has(token)) return false;
  }
  return true;
}

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/full[\s-]*stack/g, "fullstack")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !TITLE_STOP.has(token));
}

export function orgKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\.(com|co|ca|io|org|net|ai)\b/g, "")
    .replace(/\b(inc|llc|ltd|corp|corporation|company)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function span(entry: SnapshotEntry, takenAt: string): { start: number; end: number } | null {
  const start = monthIndex(entry.startDate);
  if (start === null) return null;
  const end = entry.isCurrent
    ? monthIndex(takenAt.slice(0, 7)) ?? start
    : monthIndex(entry.endDate) ?? start;
  return { start, end: Math.max(start, end) };
}

function monthIndex(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseResumeDate(value);
  if (!parsed) return null;
  return parsed.year * 12 + (parsed.month ?? 1);
}
