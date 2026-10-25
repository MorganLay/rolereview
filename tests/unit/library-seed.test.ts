import { describe, expect, it } from "vitest";

import { libraryHealth } from "@/features/library/health";
import { bulletStrength, type StrengthTier } from "@/features/library/strength";
import type { Library, LibraryEntry } from "@/features/library/types";
import { SEED_LIBRARY } from "../../prisma/library-seed";

const DATE = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/;

const EXPECTED_TIERS: StrengthTier[] = [
  "excellent",
  "weak",
  "fair",
  "strong",
  "good",
  "weak",
  "excellent",
  "good",
  "good",
];

function asLibrary(): Library {
  const sortByKind = new Map<string, number>();
  const entries: LibraryEntry[] = SEED_LIBRARY.entries.map((entry, entryIndex) => {
    const sortOrder = sortByKind.get(entry.kind) ?? 0;
    sortByKind.set(entry.kind, sortOrder + 1);
    return {
      id: `entry-${entryIndex}`,
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization,
      location: entry.location,
      startDate: entry.startDate,
      endDate: entry.isCurrent ? null : entry.endDate,
      isCurrent: entry.isCurrent,
      url: entry.url,
      sortOrder,
      bullets: entry.bullets.map((bullet, bulletIndex) => ({
        id: `bullet-${entryIndex}-${bulletIndex}`,
        text: bullet.text,
        sortOrder: bulletIndex,
      })),
    };
  });

  return {
    profile: {
      fullName: SEED_LIBRARY.profile.fullName,
      headline: SEED_LIBRARY.profile.headline,
      email: "avery@example.com",
      phone: SEED_LIBRARY.profile.phone,
      location: SEED_LIBRARY.profile.location,
      links: [...SEED_LIBRARY.profile.links],
      summary: SEED_LIBRARY.profile.summary,
    },
    entries,
    skills: SEED_LIBRARY.skills.map((skill, index) => ({
      id: `skill-${index}`,
      name: skill.name,
      category: skill.category,
      sortOrder: index,
    })),
  };
}

describe("library seed fixture", () => {
  it("matches the library counts from the data model", () => {
    const kinds = SEED_LIBRARY.entries.map((entry) => entry.kind);
    expect(kinds.filter((kind) => kind === "EXPERIENCE")).toHaveLength(3);
    expect(kinds.filter((kind) => kind === "PROJECT")).toHaveLength(2);
    expect(kinds.filter((kind) => kind === "EDUCATION")).toHaveLength(1);
    expect(SEED_LIBRARY.entries).toHaveLength(6);
    expect(SEED_LIBRARY.skills).toHaveLength(15);
  });

  it("keeps skill names unique and within the library caps", () => {
    const keys = SEED_LIBRARY.skills.map((skill) => skill.name.trim().toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    for (const skill of SEED_LIBRARY.skills) {
      expect(skill.name.trim().length).toBeGreaterThan(0);
      expect(skill.name.length).toBeLessThanOrEqual(50);
      if (skill.category !== null) {
        expect(skill.category.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it("uses resume dates and clears the end date on a current role", () => {
    const current = SEED_LIBRARY.entries.filter((entry) => entry.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0]?.endDate).toBeNull();
    for (const entry of SEED_LIBRARY.entries) {
      expect(entry.title.length).toBeLessThanOrEqual(120);
      if (entry.startDate !== null) expect(entry.startDate).toMatch(DATE);
      if (entry.endDate !== null) expect(entry.endDate).toMatch(DATE);
      if (entry.url !== null) {
        expect(entry.url.startsWith("https://")).toBe(true);
        expect(entry.url.length).toBeLessThanOrEqual(300);
      }
      for (const bullet of entry.bullets) {
        expect(bullet.text.trim().length).toBeGreaterThan(0);
        expect(bullet.text.length).toBeLessThanOrEqual(400);
      }
    }
  });

  it("mixes weak bullets with strong and excellent ones", () => {
    const names = SEED_LIBRARY.skills.map((skill) => skill.name);
    const tiers = SEED_LIBRARY.entries.flatMap((entry) =>
      entry.bullets.map((bullet) => bulletStrength(bullet.text, names).tier),
    );
    expect(tiers).toEqual(EXPECTED_TIERS);
    expect(tiers).toContain("weak");
    expect(tiers.some((tier) => tier === "strong" || tier === "excellent")).toBe(
      true,
    );
  });

  it("scores a complete library and still names a fix on the weakest bullet", () => {
    const health = libraryHealth(asLibrary());
    expect(health.percent).toBe(100);
    expect(health.bulletCount).toBe(EXPECTED_TIERS.length);
    expect(health.strongOrBetter).toBe(
      EXPECTED_TIERS.filter((tier) => tier === "strong" || tier === "excellent").length,
    );
    expect(health.strongOrBetter).toBeLessThan(health.bulletCount);
    expect(health.passed).toEqual([
      "profile",
      "experience",
      "skills",
      "recentBullets",
      "goodBullets",
    ]);
    expect(health.weakest[0]?.tier).toBe("weak");
    expect(health.weakest[0]?.fix).toEqual(expect.any(String));
    expect(health.weakest[0]?.fix?.length).toBeGreaterThan(0);
  });
});
