/**
 * How a resume version shows a library fact.
 * The library row is not rewritten. Older resumes omit these fields
 * and keep the snapshot heading.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";
import { headlineRankAllowed, headlineShapeAllowed } from "@/features/library/rewrite-guard";
import { KNOWN_TERMS } from "@/features/library/strength";
import { hasUnsupportedNumber } from "@/lib/ai/numbers";

import { termAppears } from "./keywords";
import type { ContentEntry, EditorialPlan, ResumeContent } from "./schemas";

type SnapshotEntry = LibrarySnapshot["entries"][number];

export type ShownEntry = {
  title: string;
  organization: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
};

export function shownHeadline(
  content: Pick<ResumeContent, "headline">,
  profile: LibrarySnapshot["profile"],
): string | null {
  if (content.headline !== undefined) return clean(content.headline);
  return clean(profile.headline);
}

export function shownEntry(entry: ContentEntry, source: SnapshotEntry): ShownEntry {
  return {
    title: entry.displayTitle !== undefined ? (entry.displayTitle ?? "") : source.title,
    organization:
      entry.displayOrganization !== undefined ? entry.displayOrganization : source.organization,
    location: source.location,
    startDate: entry.displayStart !== undefined ? entry.displayStart : source.startDate,
    endDate: entry.displayEnd !== undefined ? entry.displayEnd : source.endDate,
    isCurrent: entry.displayCurrent !== undefined ? entry.displayCurrent : source.isCurrent,
  };
}

/**
 * A job-specific headline. Empty when the line repeats a job title,
 * names a rank or tool the library does not, or reads like a bullet.
 * The profile headline is not reused for a new resume.
 */
export function jobHeadline(
  plan: EditorialPlan | undefined,
  snapshot: LibrarySnapshot,
  jobTitle: string,
): string | null {
  const line = plan?.headline?.trim() ?? "";
  if (line.length === 0) return null;
  const titles = snapshot.entries.map((entry) => entry.title);
  if (!headlineShapeAllowed(line, [...titles, jobTitle])) return null;
  const evidence = libraryEvidence(snapshot);
  if (!headlineRankAllowed(line, evidence)) return null;
  if (hasUnsupportedNumber(line, evidence)) return null;
  const haystack = evidence.join("\n");
  for (const term of KNOWN_TERMS) {
    if (term.length < 3) continue;
    if (termAppears(line, term) && !termAppears(haystack, term)) return null;
  }
  return line;
}

function libraryEvidence(snapshot: LibrarySnapshot): string[] {
  const lines = [
    snapshot.profile.headline ?? "",
    snapshot.profile.summary ?? "",
    ...snapshot.skills.map((skill) => skill.name),
  ];
  for (const entry of snapshot.entries) {
    lines.push(entry.title, entry.organization ?? "");
    for (const bullet of entry.bullets) lines.push(bullet.text);
  }
  return lines;
}

function clean(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length === 0 ? null : trimmed;
}
