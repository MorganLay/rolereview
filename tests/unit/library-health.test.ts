import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import { libraryHealth } from "@/features/library/health";
import type { Library, LibraryBullet, LibraryEntry, LibraryProfile, LibrarySkill } from "@/features/library/types";

const EXCELLENT = "Led a team of 12 engineers using React and SQL daily.";
const WEAK = "Hello there friend from town today.";

function profile(overrides: Partial<LibraryProfile> = {}): LibraryProfile {
  return {
    fullName: "Ada Lovelace",
    headline: "Engineer",
    email: "ada@example.com",
    phone: null,
    location: "Ottawa",
    links: [],
    summary: "Builds careful systems.",
    ...overrides,
  };
}

function bullet(id: string, text: string): LibraryBullet {
  return { id, text, sortOrder: 0 };
}

function entry(
  partial: Partial<LibraryEntry> & Pick<LibraryEntry, "id" | "kind">,
): LibraryEntry {
  return {
    title: partial.title ?? "Role",
    organization: null,
    location: null,
    startDate: "2020-01",
    endDate: null,
    isCurrent: false,
    url: null,
    sortOrder: 0,
    bullets: [],
    ...partial,
  };
}

function skills(count: number): LibrarySkill[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `skill-${index}`,
    name: `Skill ${index}`,
    category: null,
    sortOrder: index,
  }));
}

function library(overrides: Partial<Library> = {}): Library {
  return {
    profile: profile(),
    entries: [
      entry({
        id: "role",
        kind: "EXPERIENCE",
        isCurrent: true,
        bullets: [bullet("b1", EXCELLENT), bullet("b2", EXCELLENT), bullet("b3", EXCELLENT)],
      }),
    ],
    skills: skills(5),
    ...overrides,
  };
}

describe("libraryHealth", () => {
  it("scores an empty library at 0", () => {
    const result = libraryHealth({
      profile: profile({
        fullName: null,
        headline: null,
        location: null,
        summary: null,
      }),
      entries: [],
      skills: [],
    });
    expect(result.percent).toBe(0);
    expect(result.passed).toEqual([]);
    expect(result.weakest).toEqual([]);
    expect(result.belowGood).toBe(0);
  });

  it("scores a complete library at 100 and hides excellent bullets", () => {
    const result = libraryHealth(library());
    expect(result.percent).toBe(100);
    expect(result.passed).toEqual([
      "profile",
      "experience",
      "skills",
      "recentBullets",
      "goodBullets",
    ]);
    expect(result.weakest).toEqual([]);
    expect(result.belowGood).toBe(0);
  });

  it("treats phone and links as optional and whitespace as empty", () => {
    const ready = libraryHealth(library());
    expect(ready.passed).toContain("profile");

    const blank = libraryHealth(
      library({ profile: profile({ fullName: "   ", phone: "555", links: [{ label: "Site", url: "https://example.com" }] }) }),
    );
    expect(blank.passed).not.toContain("profile");
    expect(blank.percent).toBe(80);
  });

  it("counts only Experience entries", () => {
    const result = libraryHealth(
      library({
        entries: [
          entry({
            id: "project",
            kind: "PROJECT",
            isCurrent: true,
            title: "Side project",
            bullets: [bullet("p1", EXCELLENT), bullet("p2", EXCELLENT), bullet("p3", EXCELLENT)],
          }),
        ],
      }),
    );
    expect(result.passed).not.toContain("experience");
    expect(result.passed).not.toContain("recentBullets");
    expect(result.passed).toContain("goodBullets");
  });

  it("requires five skills", () => {
    expect(libraryHealth(library({ skills: skills(4) })).passed).not.toContain("skills");
    expect(libraryHealth(library({ skills: skills(5) })).passed).toContain("skills");
  });

  it("fails when any current role has fewer than three bullets", () => {
    const result = libraryHealth(
      library({
        entries: [
          entry({
            id: "now-a",
            kind: "EXPERIENCE",
            isCurrent: true,
            bullets: [bullet("a1", EXCELLENT), bullet("a2", EXCELLENT), bullet("a3", EXCELLENT)],
          }),
          entry({
            id: "now-b",
            kind: "EXPERIENCE",
            isCurrent: true,
            title: "Second role",
            bullets: [bullet("b1", EXCELLENT), bullet("b2", EXCELLENT)],
          }),
        ],
      }),
    );
    expect(result.passed).not.toContain("recentBullets");
  });

  it("passes when every current role has three bullets", () => {
    const result = libraryHealth(
      library({
        entries: [
          entry({
            id: "now-a",
            kind: "EXPERIENCE",
            isCurrent: true,
            bullets: [bullet("a1", EXCELLENT), bullet("a2", EXCELLENT), bullet("a3", EXCELLENT)],
          }),
          entry({
            id: "now-b",
            kind: "EXPERIENCE",
            isCurrent: true,
            bullets: [bullet("c1", EXCELLENT), bullet("c2", EXCELLENT), bullet("c3", EXCELLENT)],
          }),
        ],
      }),
    );
    expect(result.passed).toContain("recentBullets");
  });

  it("uses the latest experience entry when none is current", () => {
    const older = entry({
      id: "old",
      kind: "EXPERIENCE",
      startDate: "2019",
      bullets: [],
    });
    const latest = entry({
      id: "new",
      kind: "EXPERIENCE",
      startDate: "2020-06",
      sortOrder: 1,
      bullets: [bullet("n1", EXCELLENT), bullet("n2", EXCELLENT), bullet("n3", EXCELLENT)],
    });
    expect(libraryHealth(library({ entries: [older, latest] })).passed).toContain(
      "recentBullets",
    );

    const thinLatest = entry({
      ...latest,
      bullets: [bullet("n1", EXCELLENT), bullet("n2", EXCELLENT)],
    });
    expect(
      libraryHealth(library({ entries: [{ ...older, bullets: Array.from({ length: 10 }, (_, index) => bullet(`o${index}`, EXCELLENT)) }, thinLatest] })).passed,
    ).not.toContain("recentBullets");
  });

  it("ranks a later year ahead of an earlier month", () => {
    const result = libraryHealth(
      library({
        entries: [
          entry({
            id: "dec",
            kind: "EXPERIENCE",
            startDate: "2020-12",
            bullets: [],
          }),
          entry({
            id: "year",
            kind: "EXPERIENCE",
            startDate: "2021",
            sortOrder: 1,
            bullets: [bullet("y1", EXCELLENT), bullet("y2", EXCELLENT), bullet("y3", EXCELLENT)],
          }),
        ],
      }),
    );
    expect(result.passed).toContain("recentBullets");
  });

  it("ranks a month ahead of a bare year in the same year", () => {
    const result = libraryHealth(
      library({
        entries: [
          entry({
            id: "year",
            kind: "EXPERIENCE",
            startDate: "2020",
            bullets: [bullet("y1", EXCELLENT), bullet("y2", EXCELLENT), bullet("y3", EXCELLENT)],
          }),
          entry({
            id: "june",
            kind: "EXPERIENCE",
            startDate: "2020-06",
            sortOrder: 1,
            bullets: [bullet("j1", EXCELLENT)],
          }),
        ],
      }),
    );
    expect(result.passed).not.toContain("recentBullets");
  });

  it("breaks a date tie with sort order, then id", () => {
    const first = entry({
      id: "b",
      kind: "EXPERIENCE",
      startDate: "2020-01",
      sortOrder: 0,
      bullets: [bullet("f1", EXCELLENT)],
    });
    const second = entry({
      id: "a",
      kind: "EXPERIENCE",
      startDate: "2020-01",
      sortOrder: 1,
      bullets: [bullet("s1", EXCELLENT), bullet("s2", EXCELLENT), bullet("s3", EXCELLENT)],
    });
    expect(libraryHealth(library({ entries: [second, first] })).passed).not.toContain(
      "recentBullets",
    );

    const sameOrder = libraryHealth(
      library({
        entries: [
          entry({
            id: "b",
            kind: "EXPERIENCE",
            startDate: "2020-01",
            sortOrder: 0,
            bullets: [bullet("b1", EXCELLENT), bullet("b2", EXCELLENT), bullet("b3", EXCELLENT)],
          }),
          entry({
            id: "a",
            kind: "EXPERIENCE",
            startDate: "2020-01",
            sortOrder: 0,
            bullets: [bullet("a1", EXCELLENT)],
          }),
        ],
      }),
    );
    expect(sameOrder.passed).not.toContain("recentBullets");
  });

  it("passes Good+ at exactly half and fails below that", () => {
    const half = libraryHealth(
      library({
        entries: [
          entry({
            id: "role",
            kind: "EXPERIENCE",
            isCurrent: true,
            bullets: [
              bullet("e1", EXCELLENT),
              bullet("e2", EXCELLENT),
              bullet("w1", WEAK),
              bullet("w2", WEAK),
            ],
          }),
        ],
      }),
    );
    expect(half.passed).toContain("goodBullets");
    expect(half.passed).toContain("recentBullets");

    const below = libraryHealth(
      library({
        entries: [
          entry({
            id: "role",
            kind: "EXPERIENCE",
            isCurrent: true,
            bullets: [bullet("e1", EXCELLENT), bullet("w1", WEAK), bullet("w2", WEAK)],
          }),
        ],
      }),
    );
    expect(below.passed).not.toContain("goodBullets");
  });

  it("counts project bullets toward Good+ and the weakest list", () => {
    const result = libraryHealth(
      library({
        entries: [
          entry({
            id: "role",
            kind: "EXPERIENCE",
            isCurrent: true,
            title: "Engineer",
            bullets: [bullet("e1", EXCELLENT), bullet("e2", EXCELLENT), bullet("e3", EXCELLENT)],
          }),
          entry({
            id: "project",
            kind: "PROJECT",
            title: "Side project",
            bullets: [bullet("p1", WEAK)],
          }),
        ],
      }),
    );
    expect(result.passed).toContain("goodBullets");
    expect(result.passed).toContain("recentBullets");
    expect(result.weakest).toHaveLength(1);
    expect(result.weakest[0]).toMatchObject({
      id: "p1",
      entryId: "project",
      entryTitle: "Side project",
      text: WEAK,
      score: 2,
      tier: "weak",
    });
    expect(result.weakest[0]?.fix).toBe("Start with an action verb to reach Fair.");
    expect(result.weakest[0]?.example).toBe(strings.strength.examples.verb);
    expect(result.weakest[0]?.fixes[0]).toBe(result.weakest[0]?.fix);
  });

  it("lists at most five bullets, lowest score first", () => {
    const texts = ["f line", "e line", "d line", "c line", "b line", "a line"];
    const result = libraryHealth(
      library({
        entries: [
          entry({
            id: "role",
            kind: "EXPERIENCE",
            isCurrent: true,
            bullets: texts.map((text, index) => bullet(`id-${index}`, `${WEAK} ${text}`)),
          }),
        ],
      }),
    );
    expect(result.weakest.map((item) => item.text)).toEqual([
      `${WEAK} a line`,
      `${WEAK} b line`,
      `${WEAK} c line`,
      `${WEAK} d line`,
      `${WEAK} e line`,
    ]);
  });

  it("fails Good+ when there are no bullets", () => {
    const result = libraryHealth(
      library({
        entries: [entry({ id: "role", kind: "EXPERIENCE", isCurrent: true, bullets: [] })],
      }),
    );
    expect(result.passed).not.toContain("goodBullets");
    expect(result.passed).not.toContain("recentBullets");
    expect(result.weakest).toEqual([]);
  });
});
