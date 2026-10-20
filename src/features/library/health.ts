/**
 * Library completeness. Five checks, 20% each. docs/02-USER-FLOWS.md → /library.
 * Profile: name, headline, location, and summary.
 * Recent role: every current Experience entry, or the latest one if none is current.
 */

import { bulletStrength, type StrengthTier } from "./strength";
import type { Library, LibraryEntry, LibraryProfile } from "./types";

export const HEALTH_CHECK_IDS = [
  "profile",
  "experience",
  "skills",
  "recentBullets",
  "goodBullets",
] as const;

export type HealthCheckId = (typeof HEALTH_CHECK_IDS)[number];

export type WeakBullet = {
  id: string;
  entryId: string;
  entryTitle: string;
  text: string;
  score: number;
  tier: StrengthTier;
  fix: string | null;
};

export type LibraryHealth = {
  percent: number;
  passed: HealthCheckId[];
  weakest: WeakBullet[];
};

const SKILL_TARGET = 5;
const RECENT_BULLET_TARGET = 3;
const WEAKEST_LIMIT = 5;
const GOOD_SCORE = 4;
const EXCELLENT_SCORE = 6;

export function libraryHealth(library: Library): LibraryHealth {
  const passed: HealthCheckId[] = [];
  if (profileComplete(library.profile)) passed.push("profile");
  if (library.entries.some((entry) => entry.kind === "EXPERIENCE")) {
    passed.push("experience");
  }
  if (library.skills.length >= SKILL_TARGET) passed.push("skills");

  const recent = recentExperience(library.entries);
  if (
    recent.length > 0 &&
    recent.every((entry) => entry.bullets.length >= RECENT_BULLET_TARGET)
  ) {
    passed.push("recentBullets");
  }

  const skillNames = library.skills.map((skill) => skill.name);
  const scored = library.entries.flatMap((entry) =>
    entry.bullets.map((bullet) => ({
      entry,
      bullet,
      strength: bulletStrength(bullet.text, skillNames),
    })),
  );
  const goodCount = scored.filter((item) => item.strength.score >= GOOD_SCORE).length;
  if (scored.length > 0 && goodCount * 2 >= scored.length) passed.push("goodBullets");

  const weakest = scored
    .filter((item) => item.strength.score < EXCELLENT_SCORE)
    .sort((a, b) => {
      if (a.strength.score !== b.strength.score) {
        return a.strength.score - b.strength.score;
      }
      const byText = a.bullet.text.localeCompare(b.bullet.text);
      if (byText !== 0) return byText;
      return a.bullet.id.localeCompare(b.bullet.id);
    })
    .slice(0, WEAKEST_LIMIT)
    .map((item) => ({
      id: item.bullet.id,
      entryId: item.entry.id,
      entryTitle: item.entry.title,
      text: item.bullet.text,
      score: item.strength.score,
      tier: item.strength.tier,
      fix: item.strength.fixes[0] ?? null,
    }));

  return { percent: passed.length * 20, passed, weakest };
}

function profileComplete(profile: LibraryProfile): boolean {
  return (
    filled(profile.fullName) &&
    filled(profile.headline) &&
    filled(profile.location) &&
    filled(profile.summary)
  );
}

function filled(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}

/**
 * A missing month ranks before January of that year (`2020` < `2020-01`).
 * A later year always beats an earlier one (`2021` > `2020-12`).
 * Parsed here so this module does not import `dates.ts` (that file reads the
 * current year for the entry date picker).
 */
function startRank(value: string | null): number {
  if (value === null) return -1;
  const match = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(value);
  if (!match) return -1;
  const year = Number(match[1]);
  if (year < 1900 || year > 2099) return -1;
  const month = match[2] === undefined ? 0 : Number(match[2]);
  return year * 100 + month;
}

function recentExperience(entries: LibraryEntry[]): LibraryEntry[] {
  const experience = entries.filter((entry) => entry.kind === "EXPERIENCE");
  const current = experience.filter((entry) => entry.isCurrent);
  if (current.length > 0) return current;
  if (experience.length === 0) return [];

  const ranked = [...experience].sort((a, b) => {
    const byDate = startRank(b.startDate) - startRank(a.startDate);
    if (byDate !== 0) return byDate;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });
  const latest = ranked[0];
  return latest ? [latest] : [];
}
