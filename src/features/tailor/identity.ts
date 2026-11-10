/**
 * Canonical identity for education records and contact links.
 * Matching uses the institution and the credential, not a text-similarity score.
 */

import { parseResumeDate } from "@/features/library/dates";
import type { LibrarySnapshot } from "@/features/library/schemas";

type SnapshotEntry = LibrarySnapshot["entries"][number];

const INSTITUTION_STOP = new Set([
  "the",
  "of",
  "and",
  "at",
  "for",
  "university",
  "college",
  "institute",
  "school",
  "campus",
  "univ",
]);

const TITLE_STOP = new Set(["the", "of", "in", "and", "honours", "honors", "hons", "with"]);

const NOT_CONTACT_HOSTS = ["coursera.org", "udemy.com", "moodle.org", "edx.org"];

export type EducationIdentity = {
  institution: string;
  credential: string;
};

export type LinkClass = "github" | "linkedin" | "portfolio" | "other" | "not_contact" | "invalid";

export function educationIdentity(entry: {
  title: string;
  organization: string | null;
}): EducationIdentity | null {
  const institution = institutionKey(entry.organization);
  const credential = credentialKey(entry.title);
  if (!institution || !credential) return null;
  return { institution, credential };
}

/** Same conferred degree. A different level or field stays separate. */
export function sameDegree(left: SnapshotEntry, right: SnapshotEntry): boolean {
  if (left.kind !== "EDUCATION" || right.kind !== "EDUCATION") return false;
  if (left.ref === right.ref) return true;
  const a = educationIdentity(left);
  const b = educationIdentity(right);
  if (!a || !b) return false;
  if (a.institution !== b.institution || a.credential !== b.credential) return false;
  if (a.credential.endsWith(":general") && titleKey(left.title) !== titleKey(right.title)) {
    return false;
  }
  return yearsCompatible(left, right);
}

/**
 * One resume row per degree. A selected row that already has bullets wins.
 * Otherwise the richer library row wins. Ties keep snapshot order.
 */
export function chooseEducationKeepers(
  entries: readonly SnapshotEntry[],
  selectedBullets: ReadonlyMap<string, number>,
): { keep: string[]; drop: { ref: string; kept: string }[] } {
  const clusters: SnapshotEntry[][] = [];
  for (const entry of entries) {
    if (entry.kind !== "EDUCATION") continue;
    const cluster = clusters.find((group) => group.some((other) => sameDegree(entry, other)));
    if (cluster) cluster.push(entry);
    else clusters.push([entry]);
  }

  const keep: string[] = [];
  const drop: { ref: string; kept: string }[] = [];
  for (const cluster of clusters) {
    const winner = pickEducation(cluster, selectedBullets);
    keep.push(winner.ref);
    for (const entry of cluster) {
      if (entry.ref !== winner.ref) drop.push({ ref: entry.ref, kept: winner.ref });
    }
  }
  return { keep, drop };
}

export function classifyLink(label: string, url: string): LinkClass {
  let host = "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "invalid";
    host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "invalid";
  }
  if (host === "github.com" || host.endsWith(".github.io")) return "github";
  if (host.endsWith("linkedin.com")) return "linkedin";
  if (NOT_CONTACT_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))) {
    return "not_contact";
  }
  if (/\b(course|class|lecture|mooc)\b/i.test(label)) return "not_contact";
  if (/\b(portfolio|personal site|website)\b/i.test(label)) return "portfolio";
  return "other";
}

/** Host and path, without www or a trailing slash. Null when the URL is not http(s). */
export function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return null;
  }
}

function pickEducation(
  cluster: readonly SnapshotEntry[],
  selectedBullets: ReadonlyMap<string, number>,
): SnapshotEntry {
  const selected = cluster.filter((entry) => selectedBullets.has(entry.ref));
  const withBullets = selected.filter((entry) => (selectedBullets.get(entry.ref) ?? 0) > 0);
  const pool = withBullets.length > 0 ? withBullets : selected.length > 0 ? selected : cluster;
  return [...pool].sort((left, right) => {
    if (withBullets.length > 0) {
      const written =
        (selectedBullets.get(right.ref) ?? 0) - (selectedBullets.get(left.ref) ?? 0);
      if (written !== 0) return written;
    }
    const library = right.bullets.length - left.bullets.length;
    if (library !== 0) return library;
    return right.title.trim().length - left.title.trim().length;
  })[0] ?? cluster[0]!;
}

function institutionKey(organization: string | null): string | null {
  if (!organization) return null;
  const tokens = words(organization).filter(
    (token) => token.length > 1 && !INSTITUTION_STOP.has(token),
  );
  if (tokens.length === 0) return null;
  return tokens.join(" ");
}

function credentialKey(title: string): string | null {
  const text = words(title).join(" ");
  if (text.length === 0) return null;
  const level = degreeLevel(text);
  const field = degreeField(text);
  if (!level && !field) return null;
  return `${level ?? "degree"}:${field ?? "general"}`;
}

function degreeLevel(text: string): string | null {
  if (/\b(ph d|phd|doctorate|doctor of)\b/.test(text)) return "doctorate";
  if (/\b(master|masters|msc|m sc|meng|m eng|mba|m cs|mcs)\b/.test(text)) return "master";
  if (/\b(bachelor|bachelors|b sc|bsc|b cs|bcs|b eng|beng)\b/.test(text) || /\bb c s\b/.test(text)) {
    return "bachelor";
  }
  if (/\bdiploma\b/.test(text)) return "diploma";
  if (/\b(certificate|certification)\b/.test(text)) return "certificate";
  return null;
}

function degreeField(text: string): string | null {
  if (/\bcomputer science\b/.test(text) || /\bb c s\b/.test(text) || /\bbcs\b/.test(text)) {
    return "computer-science";
  }
  if (/\bsoftware engineering\b/.test(text)) return "software-engineering";
  if (/\bdata science\b/.test(text)) return "data-science";
  if (/\b(information technology|information systems)\b/.test(text)) return "information-technology";
  return null;
}

function titleKey(title: string): string {
  return words(title)
    .filter((token) => !TITLE_STOP.has(token))
    .join(" ");
}

function yearsCompatible(left: SnapshotEntry, right: SnapshotEntry): boolean {
  const a = endYear(left);
  const b = endYear(right);
  if (a === null || b === null) return true;
  return Math.abs(a - b) <= 1;
}

function endYear(entry: SnapshotEntry): number | null {
  if (entry.isCurrent) return null;
  const parsed = entry.endDate ? parseResumeDate(entry.endDate) : null;
  return parsed?.year ?? null;
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0);
}
