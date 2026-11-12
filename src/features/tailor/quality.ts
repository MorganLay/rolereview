/**
 * Deterministic comparison measures. Keyword overlap and bullet count
 * are reported, not treated as quality.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";

import { isContributionHeading } from "./canonical";
import { normalizeMatchText, termAppears } from "./keywords";
import { shownEntry } from "./presentation";
import type { ResumeContent } from "./schemas";
import { employersMatch } from "./stints";

export type ResumeQuality = {
  includedBullets: number;
  includedExperience: number;
  duplicateEmployers: number;
  awkwardHeadings: number;
  skillsOutsideEvidence: number;
  unresolvedConflicts: number;
  repeatedQuantities: number;
};

export function resumeQuality(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): ResumeQuality {
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  const experience = content.entries.filter((entry) => entry.included && entry.kind === "EXPERIENCE");
  let duplicateEmployers = 0;
  for (let index = 0; index < experience.length; index += 1) {
    for (let other = index + 1; other < experience.length; other += 1) {
      const left = experience[index];
      const right = experience[other];
      const leftSource = left ? byRef.get(left.ref) : undefined;
      const rightSource = right ? byRef.get(right.ref) : undefined;
      if (!left || !right || !leftSource || !rightSource) continue;
      const leftShown = shownEntry(left, leftSource);
      const rightShown = shownEntry(right, rightSource);
      if (employersMatch(leftShown.organization, rightShown.organization)) duplicateEmployers += 1;
    }
  }

  const bullets = content.entries
    .filter((entry) => entry.included)
    .flatMap((entry) => entry.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.text));
  const skillBlob = bullets.join("\n");
  let skillsOutsideEvidence = 0;
  for (const group of content.skills) {
    for (const name of group.names) {
      const needle = normalizeMatchText(name);
      if (needle.length < 3) continue;
      if (!termAppears(normalizeMatchText(skillBlob), needle)) skillsOutsideEvidence += 1;
    }
  }

  let awkwardHeadings = 0;
  for (const entry of content.entries) {
    if (!entry.included || entry.kind !== "PROJECT") continue;
    const source = byRef.get(entry.ref);
    if (!source) continue;
    const shown = shownEntry(entry, source);
    if (isContributionHeading(shown.title)) awkwardHeadings += 1;
  }

  return {
    includedBullets: bullets.length,
    includedExperience: experience.length,
    duplicateEmployers,
    awkwardHeadings,
    skillsOutsideEvidence,
    unresolvedConflicts: (content.review ?? []).filter((item) => item.reason === "fact_conflict").length,
    repeatedQuantities: repeatedQuantities(bullets),
  };
}

function repeatedQuantities(bullets: readonly string[]): number {
  const seen = new Map<string, number>();
  for (const bullet of bullets) {
    const numbers = bullet.match(/\d{2,}(?:\.\d+)?/g) ?? [];
    const stems = new Set(
      normalizeMatchText(bullet)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 6)
        .map((token) => token.slice(0, 6)),
    );
    for (const number of numbers) {
      for (const stem of stems) {
        const key = `${number}:${stem}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
  }
  let repeats = 0;
  for (const count of seen.values()) {
    if (count > 1) repeats += 1;
  }
  return repeats;
}
