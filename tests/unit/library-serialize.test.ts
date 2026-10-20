import { describe, expect, it } from "vitest";

import { serializeLibrary } from "@/features/library/serialize";
import { ENTRY_KINDS, LibrarySnapshot } from "@/features/library/schemas";
import type {
  Library,
  LibraryEntry,
  LibraryProfile,
  LibrarySkill,
} from "@/features/library/types";

const EN_DASH = "\u2013";
const EM_DASH = "\u2014";
const TAKEN_AT = "2026-10-20T23:00:00.000Z";

const profile: LibraryProfile = {
  fullName: null,
  headline: null,
  email: "hidden-email@example.com",
  phone: "555-0100-SECRET",
  location: "Hidden Location",
  links: [{ label: "Site", url: "https://example.com/hidden-profile" }],
  summary: null,
};

function entry(
  overrides: Partial<LibraryEntry> & Pick<LibraryEntry, "id" | "kind" | "title">,
): LibraryEntry {
  return {
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    isCurrent: false,
    url: null,
    sortOrder: 0,
    bullets: [],
    ...overrides,
  };
}

function skill(
  overrides: Partial<LibrarySkill> & Pick<LibrarySkill, "id" | "name">,
): LibrarySkill {
  return { category: null, sortOrder: 0, ...overrides };
}

function library(overrides: Partial<Library> = {}): Library {
  return { profile, entries: [], skills: [], ...overrides };
}

describe("serializeLibrary", () => {
  it("matches the documented prompt shape and keeps contact facts on the snapshot", () => {
    const bullets = [
      {
        id: "bullet-2",
        text: "Automated monthly business review workbook with Excel VBA, cutting prep time from 2 days to 3 hours.",
        sortOrder: 2,
      },
      {
        id: "bullet-1",
        text: "Built and maintained 14 IBM Cognos reports used by a 20-person processing team.",
        sortOrder: 1,
      },
    ];
    const input = library({
      profile: {
        ...profile,
        fullName: "Morgan Example",
        headline: "Data & reporting analyst",
        summary: "…",
      },
      entries: [
        entry({
          id: "edu",
          kind: "EDUCATION",
          title: "B.CS. Honours",
          organization: "Carleton University",
          location: "Ottawa, ON",
          endDate: "2023",
          url: "https://example.com/hidden-entry-url",
        }),
        entry({
          id: "project",
          kind: "PROJECT",
          title: "Booking bot",
          startDate: "2025-03",
          endDate: "2025-04",
          bullets: [
            {
              id: "project-bullet",
              text: "Wrote a Python/Playwright bot that …",
              sortOrder: 0,
            },
          ],
        }),
        entry({
          id: "job",
          kind: "EXPERIENCE",
          title: "Junior Program Officer",
          organization: "Canada Revenue Agency",
          location: "Ottawa, ON",
          startDate: "2023-11",
          isCurrent: true,
          sortOrder: 5,
          bullets,
        }),
      ],
      skills: [
        skill({ id: "skill-3", name: "IBM Cognos", category: "Tools", sortOrder: 3 }),
        skill({ id: "skill-1", name: "Python", category: "Languages", sortOrder: 1 }),
        skill({ id: "skill-2", name: "SQL", category: "Languages", sortOrder: 2 }),
      ],
    });

    const { text, snapshot } = serializeLibrary(input, TAKEN_AT);

    expect(text).toBe(
      [
        "PROFILE",
        "Name: Morgan Example | Headline: Data & reporting analyst",
        "Default summary: …",
        "",
        `E1 | EXPERIENCE | Junior Program Officer | Canada Revenue Agency | Ottawa, ON | 2023-11 ${EN_DASH} Present`,
        "  E1.B1: Built and maintained 14 IBM Cognos reports used by a 20-person processing team.",
        "  E1.B2: Automated monthly business review workbook with Excel VBA, cutting prep time from 2 days to 3 hours.",
        `E2 | PROJECT | Booking bot | ${EM_DASH} | ${EM_DASH} | 2025-03 ${EN_DASH} 2025-04`,
        "  E2.B1: Wrote a Python/Playwright bot that …",
        `E3 | EDUCATION | B.CS. Honours | Carleton University | Ottawa, ON | ${EN_DASH} 2023`,
        "SKILLS",
        "  S1: Python (Languages)",
        "  S2: SQL (Languages)",
        "  S3: IBM Cognos (Tools)",
      ].join("\n"),
    );
    expect(text).not.toContain("hidden-email@example.com");
    expect(text).not.toContain("555-0100-SECRET");
    expect(text).not.toContain("Hidden Location");
    expect(text).not.toContain("hidden-profile");
    expect(text).not.toContain("hidden-entry-url");

    expect(snapshot.takenAt).toBe(TAKEN_AT);
    expect(snapshot.profile.email).toBe("hidden-email@example.com");
    expect(snapshot.profile.phone).toBe("555-0100-SECRET");
    expect(snapshot.profile.links).toEqual(profile.links);
    expect(snapshot.entries.map((item) => [item.ref, item.id])).toEqual([
      ["E1", "job"],
      ["E2", "project"],
      ["E3", "edu"],
    ]);
    expect(snapshot.entries[0]?.bullets.map((item) => item.ref)).toEqual([
      "E1.B1",
      "E1.B2",
    ]);
    expect(snapshot.entries[2]?.url).toBe("https://example.com/hidden-entry-url");
    expect(snapshot.skills.map((item) => item.ref)).toEqual(["S1", "S2", "S3"]);
    expect(bullets.map((item) => item.id)).toEqual(["bullet-2", "bullet-1"]);
    expect(LibrarySnapshot.parse(snapshot)).toEqual(snapshot);
  });

  it.each([
    {
      name: "current role before a later past role",
      entries: [
        entry({
          id: "past",
          kind: "EXPERIENCE",
          title: "Later role",
          startDate: "2026-01",
          endDate: "2026-06",
        }),
        entry({
          id: "current",
          kind: "EXPERIENCE",
          title: "Current role",
          startDate: "2020-01",
          isCurrent: true,
        }),
      ],
      refs: ["current", "past"],
    },
    {
      name: "year-only end date sorts as December",
      entries: [
        entry({
          id: "june",
          kind: "EXPERIENCE",
          title: "June",
          endDate: "2024-06",
        }),
        entry({
          id: "year",
          kind: "EXPERIENCE",
          title: "Year",
          endDate: "2024",
        }),
      ],
      refs: ["year", "june"],
    },
    {
      name: "year-only end date ties December, then sort order",
      entries: [
        entry({
          id: "december",
          kind: "EXPERIENCE",
          title: "December",
          endDate: "2024-12",
          sortOrder: 2,
        }),
        entry({
          id: "year",
          kind: "EXPERIENCE",
          title: "Year",
          endDate: "2024",
          sortOrder: 1,
        }),
      ],
      refs: ["year", "december"],
    },
    {
      name: "missing end date sorts after every dated end",
      entries: [
        entry({
          id: "open",
          kind: "EXPERIENCE",
          title: "Open",
          startDate: "2025-01",
        }),
        entry({
          id: "old",
          kind: "EXPERIENCE",
          title: "Old",
          endDate: "1990",
        }),
      ],
      refs: ["old", "open"],
    },
    {
      name: "unparseable end date sorts with a missing end",
      entries: [
        entry({
          id: "bad",
          kind: "EXPERIENCE",
          title: "Bad",
          endDate: "Nov 2023",
        }),
        entry({
          id: "dated",
          kind: "EXPERIENCE",
          title: "Dated",
          endDate: "1990",
        }),
      ],
      refs: ["dated", "bad"],
    },
    {
      name: "newer start date wins when end dates match",
      entries: [
        entry({
          id: "earlier",
          kind: "PROJECT",
          title: "Earlier",
          startDate: "2018-01",
          endDate: "2020-06",
        }),
        entry({
          id: "later",
          kind: "PROJECT",
          title: "Later",
          startDate: "2019-06",
          endDate: "2020-06",
        }),
      ],
      refs: ["later", "earlier"],
    },
    {
      name: "year-only start date sorts as January",
      entries: [
        entry({
          id: "year",
          kind: "PROJECT",
          title: "Year",
          startDate: "2019",
          endDate: "2020",
        }),
        entry({
          id: "june",
          kind: "PROJECT",
          title: "June",
          startDate: "2019-06",
          endDate: "2020",
        }),
      ],
      refs: ["june", "year"],
    },
    {
      name: "kinds stay in section order even when dates would scramble them",
      entries: ENTRY_KINDS.map((kind, index) =>
        entry({
          id: kind,
          kind,
          title: kind,
          endDate: `${2000 + (ENTRY_KINDS.length - index)}`,
        }),
      ).reverse(),
      refs: [...ENTRY_KINDS],
    },
    {
      name: "equal dates break by sort order, then id",
      entries: [
        entry({
          id: "b",
          kind: "VOLUNTEER",
          title: "B",
          endDate: "2021",
          sortOrder: 1,
        }),
        entry({
          id: "a",
          kind: "VOLUNTEER",
          title: "A",
          endDate: "2021",
          sortOrder: 1,
        }),
        entry({
          id: "first",
          kind: "VOLUNTEER",
          title: "First",
          endDate: "2021",
          sortOrder: 0,
        }),
      ],
      refs: ["first", "a", "b"],
    },
  ])("$name", ({ entries, refs }) => {
    const { snapshot } = serializeLibrary(library({ entries }), TAKEN_AT);
    expect(snapshot.entries.map((item) => item.id)).toEqual(refs);
  });

  it("prints partial dates, a bare Present, and a skill with no category", () => {
    const { text } = serializeLibrary(
      library({
        entries: [
          entry({
            id: "degree",
            kind: "EDUCATION",
            title: "Degree",
            endDate: "  2023  ",
          }),
          entry({
            id: "start-only",
            kind: "CERTIFICATION",
            title: "Certificate",
            startDate: "2022",
          }),
          entry({
            id: "undated",
            kind: "OTHER",
            title: " ",
          }),
          entry({
            id: "ongoing",
            kind: "EXPERIENCE",
            title: "Ongoing",
            isCurrent: true,
          }),
        ],
        skills: [
          skill({ id: "plain", name: "Excel", sortOrder: 0 }),
          skill({ id: "blank", name: "Sheets", category: "  ", sortOrder: 1 }),
        ],
      }),
      TAKEN_AT,
    );

    expect(text).toContain(
      `E1 | EXPERIENCE | Ongoing | ${EM_DASH} | ${EM_DASH} | Present`,
    );
    expect(text).toContain(
      `E2 | EDUCATION | Degree | ${EM_DASH} | ${EM_DASH} | ${EN_DASH} 2023`,
    );
    expect(text).toContain(
      `E3 | CERTIFICATION | Certificate | ${EM_DASH} | ${EM_DASH} | 2022`,
    );
    expect(text).toContain(
      `E4 | OTHER | ${EM_DASH} | ${EM_DASH} | ${EM_DASH} | ${EM_DASH}`,
    );
    expect(text).toContain("  S1: Excel\n  S2: Sheets");
    expect(text.endsWith("  S2: Sheets")).toBe(true);
    expect(text).not.toContain("Excel (");
    expect(text).not.toContain("Sheets (");
  });

  it("collapses newlines in the prompt and keeps the original text on the snapshot", () => {
    const summary = "Line one.\n\n  Line two.";
    const bullet = "Did a thing.\r\nThen another.";
    const { text, snapshot } = serializeLibrary(
      library({
        profile: { ...profile, summary },
        entries: [
          entry({
            id: "job",
            kind: "EXPERIENCE",
            title: "Role | team",
            bullets: [{ id: "bullet", text: bullet, sortOrder: 0 }],
          }),
        ],
      }),
      TAKEN_AT,
    );

    expect(text).toContain("Default summary: Line one. Line two.");
    expect(text).toContain("E1 | EXPERIENCE | Role | team |");
    expect(text).toContain("  E1.B1: Did a thing. Then another.");
    expect(snapshot.profile.summary).toBe(summary);
    expect(snapshot.entries[0]?.bullets[0]?.text).toBe(bullet);
  });

  it("serializes an empty library with the profile and skills headings", () => {
    const { text, snapshot } = serializeLibrary(library(), TAKEN_AT);

    expect(text).toBe(
      [
        "PROFILE",
        `Name: ${EM_DASH} | Headline: ${EM_DASH}`,
        `Default summary: ${EM_DASH}`,
        "",
        "SKILLS",
      ].join("\n"),
    );
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.skills).toEqual([]);
    expect(snapshot.profile.email).toBe(profile.email);
  });
});
