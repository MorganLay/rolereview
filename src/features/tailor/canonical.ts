/**
 * Canonical career evidence. Library rows stay as imported.
 * A stint is the factual record composition may print once.
 * docs/05-AI.md → Composing the resume.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";

import { employersMatch, experienceGroups, orgKey, recordsCompatible } from "./stints";

type SnapshotEntry = LibrarySnapshot["entries"][number];

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

const ROLE_PART =
  /^(co[- ]?)?(creator|founder|owner|product owner|developer|engineer|designer|analyst|intern|manager|lead|consultant|architect|researcher|student|full[- ]stack(?: developer| engineer)?|software (?:developer|engineer)|front[- ]end(?: developer)?|back[- ]end(?: developer)?)$/i;

export type CareerConfirmation = {
  members: readonly string[];
  title?: string;
  organization?: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
};

export type StintConflict = "title" | "organization" | "startDate" | "endDate" | "current";

export type CanonicalStint = {
  canonical: string;
  members: string[];
  title: string | null;
  organization: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  confidence: "agreed" | "confirmed" | "unresolved";
  conflicts: StintConflict[];
};

export type CanonicalCareer = {
  stints: CanonicalStint[];
  /** Confirmations that would have merged different jobs. They are not applied. */
  rejected: string[][];
  lineages: { members: string[] }[];
};

export type EntryDisplay = {
  displayTitle: string | null;
  displayOrganization: string | null;
  displayStart: string | null;
  displayEnd: string | null;
  displayCurrent: boolean;
};

export function confirmedMemberLists(
  confirmations: readonly CareerConfirmation[],
): string[][] {
  return confirmations
    .map((item) => [...item.members])
    .filter((members) => members.length >= 2);
}

export function canonicalizeCareer(
  entries: readonly SnapshotEntry[],
  takenAt: string,
  confirmations: readonly CareerConfirmation[] = [],
): CanonicalCareer {
  const lists = confirmedMemberLists(confirmations);
  const byRef = new Map(entries.map((entry) => [entry.ref, entry]));
  const rejected: string[][] = [];
  const accepted: string[][] = [];
  for (const members of lists) {
    const rows = members
      .map((ref) => byRef.get(ref))
      .filter((entry): entry is SnapshotEntry => entry !== undefined);
    const head = rows[0];
    if (!head || rows.length < 2) {
      rejected.push(members);
      continue;
    }
    const compatible = rows.every((row) => row.ref === head.ref || recordsCompatible(head, row));
    if (!compatible) rejected.push(members);
    else accepted.push(members);
  }

  const groups = experienceGroups(entries, takenAt, accepted);
  const stints = groups.map((group) => {
    const members = group.members
      .map((ref) => byRef.get(ref))
      .filter((entry): entry is SnapshotEntry => entry !== undefined);
    const confirmation = confirmations.find(
      (item) => item.members.length >= 2 && item.members.every((ref) => group.members.includes(ref)),
    );
    return resolveStint(members, confirmation);
  });

  return {
    stints,
    rejected,
    lineages: productLineages(entries, takenAt),
  };
}

/** Prompt text. "none" when no project is a later iteration of another. */
export function lineageText(entries: readonly SnapshotEntry[], takenAt: string): string {
  const lineages = productLineages(entries, takenAt);
  if (lineages.length === 0) return "none";
  return lineages
    .map(
      (group) =>
        `${group.members.join(", ")} are iterations of one product. Choose one heading for this job.`,
    )
    .join("\n");
}

/**
 * Pairs that name the same role but do not overlap in time.
 * They stay as separate records until a confirmation says otherwise.
 */
export function unresolvedStintPairs(
  entries: readonly SnapshotEntry[],
  takenAt: string,
  confirmations: readonly CareerConfirmation[] = [],
): string[][] {
  const career = canonicalizeCareer(entries, takenAt, confirmations);
  const grouped = new Set(career.stints.flatMap((stint) => stint.members));
  const employment = entries.filter((entry) => entry.kind === "EXPERIENCE" || entry.kind === "VOLUNTEER");
  const pairs: string[][] = [];
  for (let index = 0; index < employment.length; index += 1) {
    for (let other = index + 1; other < employment.length; other += 1) {
      const left = employment[index];
      const right = employment[other];
      if (!left || !right || left.kind !== right.kind) continue;
      if (grouped.has(left.ref) && career.stints.some((stint) => stint.members.includes(left.ref) && stint.members.includes(right.ref))) {
        continue;
      }
      if (!recordsCompatible(left, right)) continue;
      if (!left.startDate || !right.startDate) continue;
      pairs.push([left.ref, right.ref].sort());
    }
  }
  return pairs;
}

export function entryDisplay(
  entry: SnapshotEntry,
  stint: CanonicalStint | undefined,
): EntryDisplay | null {
  const project = projectHeading(entry);
  const projectChanged =
    entry.kind === "PROJECT" &&
    (project.title !== entry.title.trim() ||
      (project.organization ?? "") !== (entry.organization?.trim() ?? ""));
  if (!stint && !projectChanged) return null;
  if (!stint) {
    return {
      displayTitle: project.title,
      displayOrganization: project.organization,
      displayStart: entry.startDate,
      displayEnd: entry.endDate,
      displayCurrent: entry.isCurrent,
    };
  }
  const heading = entry.kind === "PROJECT" ? projectHeading(entry) : null;
  return {
    displayTitle: stint.title ?? heading?.title ?? null,
    displayOrganization: stint.organization,
    displayStart: stint.startDate,
    displayEnd: stint.endDate,
    displayCurrent: stint.isCurrent,
  };
}

export function isContributionHeading(title: string): boolean {
  const parts = title
    .split(/[,/]|\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 2) return false;
  return parts.every((part) => ROLE_PART.test(part));
}

function resolveStint(
  members: readonly SnapshotEntry[],
  confirmation: CareerConfirmation | undefined,
): CanonicalStint {
  const labels = members.map((entry) =>
    entry.kind === "PROJECT" ? projectHeading(entry) : { title: entry.title.trim(), organization: entry.organization?.trim() || null },
  );
  const title = agreeTitle(labels.map((label) => label.title));
  const organization = agreeOrganization(labels.map((label) => label.organization));
  const start = agreeValue(members.map((entry) => entry.startDate));
  const end = agreeValue(members.map((entry) => entry.endDate));
  const currentValues = members.map((entry) => entry.isCurrent);
  const currentConflict = currentValues.some(Boolean) && currentValues.some((value) => !value);
  const conflicts: StintConflict[] = [];
  if (title.conflict) conflicts.push("title");
  if (organization.conflict) conflicts.push("organization");
  if (start.conflict) conflicts.push("startDate");
  if (end.conflict) conflicts.push("endDate");
  if (currentConflict) conflicts.push("current");

  let resolved: CanonicalStint = {
    canonical: pickHeading(members, title.value),
    members: members.map((entry) => entry.ref),
    title: title.value,
    organization: organization.value,
    startDate: start.value,
    endDate: end.value,
    isCurrent: currentConflict ? false : currentValues.some(Boolean),
    confidence: conflicts.length > 0 ? "unresolved" : "agreed",
    conflicts,
  };

  if (!confirmation) return resolved;
  resolved = {
    ...resolved,
    title: confirmation.title ?? resolved.title,
    organization: confirmation.organization ?? resolved.organization,
    startDate: confirmation.startDate !== undefined ? confirmation.startDate : resolved.startDate,
    endDate: confirmation.endDate !== undefined ? confirmation.endDate : resolved.endDate,
    isCurrent: confirmation.isCurrent ?? (resolved.conflicts.includes("current") ? false : resolved.isCurrent),
    confidence: "confirmed",
    conflicts: [],
    canonical: pickHeading(members, confirmation.title ?? resolved.title),
  };
  return resolved;
}

function pickHeading(members: readonly SnapshotEntry[], title: string | null): string {
  const titled = title
    ? members.filter((entry) => entry.title.trim() === title || projectHeading(entry).title === title)
    : [];
  const pool = titled.length > 0 ? titled : [...members];
  const ranked = [...pool].sort((left, right) => right.bullets.length - left.bullets.length);
  return ranked[0]?.ref ?? members[0]?.ref ?? "";
}

function agreeTitle(values: readonly string[]): { value: string | null; conflict: boolean } {
  const unique = uniqueStrings(values);
  if (unique.length === 0) return { value: null, conflict: false };
  if (unique.length === 1) return { value: unique[0] ?? null, conflict: false };
  const sets = unique.map((value) => new Set(titleTokens(value)));
  const cores = unique.filter((_, index) => {
    const mine = sets[index];
    if (!mine || mine.size === 0) return false;
    return sets.every((other, otherIndex) => {
      if (otherIndex === index || !other) return true;
      for (const token of mine) {
        if (!other.has(token)) return false;
      }
      return true;
    });
  });
  if (cores.length >= 1) {
    const shortest = [...cores].sort((left, right) => left.length - right.length)[0] ?? null;
    return { value: shortest, conflict: false };
  }
  return { value: null, conflict: true };
}

function agreeOrganization(
  values: readonly (string | null)[],
): { value: string | null; conflict: boolean } {
  const present = values.filter((value): value is string => !!value && value.trim().length > 0);
  const unique = uniqueStrings(present);
  if (unique.length === 0) return { value: null, conflict: false };
  if (unique.length === 1) return { value: unique[0] ?? null, conflict: false };
  const family = unique.every((value, index) =>
    unique.every((other, otherIndex) => otherIndex === index || employersMatch(value, other) || orgKey(value) === orgKey(other)),
  );
  if (!family) return { value: null, conflict: true };
  return { value: preferOrganization(unique), conflict: false };
}

function agreeValue(
  values: readonly (string | null)[],
): { value: string | null; conflict: boolean } {
  const present = [...new Set(values.filter((value): value is string => !!value))];
  if (present.length === 0) return { value: null, conflict: false };
  if (present.length === 1) return { value: present[0] ?? null, conflict: false };
  return { value: null, conflict: true };
}

function preferOrganization(values: readonly string[]): string {
  return [...values].sort((left, right) => organizationScore(right) - organizationScore(left))[0] ?? values[0] ?? "";
}

function organizationScore(value: string): number {
  let score = value.replace(/[^a-z0-9]/gi, "").length;
  if (/\s/.test(value)) score += 20;
  if (/\.(com|co|io|ca|org|net|ai)\b/i.test(value)) score -= 30;
  if (value.trim().length <= 6 && !/\s/.test(value)) score -= 10;
  return score;
}

function projectHeading(entry: SnapshotEntry): { title: string; organization: string | null } {
  const title = entry.title.trim();
  const organization = entry.organization?.trim() || null;
  if (entry.kind !== "PROJECT") return { title, organization };
  if (organization && isContributionHeading(title) && !isContributionHeading(organization)) {
    return { title: organization, organization: null };
  }
  if (organization && isContributionHeading(organization) && title && !isContributionHeading(title)) {
    return { title, organization: null };
  }
  return { title, organization };
}

function productLineages(
  entries: readonly SnapshotEntry[],
  takenAt: string,
): { members: string[] }[] {
  const projects = entries.filter((entry) => entry.kind === "PROJECT");
  const same = experienceGroups(projects, takenAt);
  const together = (left: string, right: string) =>
    same.some((group) => group.members.includes(left) && group.members.includes(right));
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
  for (let index = 0; index < projects.length; index += 1) {
    for (let other = index + 1; other < projects.length; other += 1) {
      const left = projects[index];
      const right = projects[other];
      if (!left || !right || together(left.ref, right.ref)) continue;
      if (!relatedProducts(left, right)) continue;
      unite(left.ref, right.ref);
    }
  }
  const buckets = new Map<string, string[]>();
  for (const entry of projects) {
    const root = find(entry.ref);
    const list = buckets.get(root) ?? [];
    list.push(entry.ref);
    buckets.set(root, list);
  }
  return [...buckets.values()]
    .filter((members) => members.length >= 2)
    .map((members) => ({ members }));
}

function relatedProducts(left: SnapshotEntry, right: SnapshotEntry): boolean {
  if (namesOther(left, right) || namesOther(right, left)) return true;
  const leftHost = productHost(left.url);
  const rightHost = productHost(right.url);
  return leftHost !== null && leftHost === rightHost;
}

function namesOther(source: SnapshotEntry, named: SnapshotEntry): boolean {
  const name = named.title.trim();
  if (name.length < 4) return false;
  const blob = [source.title, source.organization ?? "", ...source.bullets.map((bullet) => bullet.text)]
    .join(" ")
    .toLowerCase();
  return blob.includes(name.toLowerCase());
}

function productHost(value: string | null): string | null {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "github.com" || host.endsWith("linkedin.com")) return null;
    return host;
  } catch {
    return null;
  }
}

function titleTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !TITLE_STOP.has(token));
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.set(key, value.trim());
  }
  return [...seen.values()];
}
