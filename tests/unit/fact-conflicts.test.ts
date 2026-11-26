import { describe, expect, it } from "vitest";

import type { LibrarySnapshot } from "@/features/library/schemas";
import { factConflictDetails } from "@/features/tailor/conflicts";
import { noteAgrees } from "@/features/tailor/review";
import type { ResumeContent } from "@/features/tailor/schemas";

function entry(
  ref: string,
  startDate: string,
  endDate: string,
): LibrarySnapshot["entries"][number] {
  return {
    ref,
    id: ref,
    kind: "EXPERIENCE",
    title: "Software Developer",
    organization: "Acme",
    location: null,
    startDate,
    endDate,
    isCurrent: false,
    url: null,
    bullets: [{ ref: `${ref}.B1`, id: `${ref}-b`, text: "Built internal tools." }],
  };
}

function snapshot(): LibrarySnapshot {
  return {
    takenAt: "2026-11-19T00:00:00.000Z",
    profile: {
      fullName: "Morgan Example",
      headline: null,
      email: "morgan@example.com",
      phone: null,
      location: null,
      links: [],
      summary: null,
    },
    entries: [entry("E1", "2020-01", "2021-06"), entry("E2", "2020-06", "2022-01")],
    skills: [],
  };
}

function content(): ResumeContent {
  return {
    schemaVersion: 1,
    summary: { text: "", included: false },
    entries: [
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [],
      },
    ],
    skills: [],
    review: [
      { code: "PRESENTATION", severity: "warning", ref: "E1", reason: "fact_conflict" },
    ],
  };
}

describe("fact conflicts", () => {
  it("names both date values and does not choose one", () => {
    const details = factConflictDetails(content(), snapshot());
    const text = JSON.stringify(details);
    expect(text).toContain("2020-01");
    expect(text).toContain("2020-06");
    expect(text).toContain("2021-06");
    expect(text).toContain("2022-01");
    expect(details.every((item) => item.sides.length >= 2)).toBe(true);
  });

  it("drops a rewrite note that disagrees with the line on the page", () => {
    expect(noteAgrees("The line was kept unchanged.", true)).toBeNull();
    expect(noteAgrees("The line was kept unchanged.", false)).toBe(
      "The line was kept unchanged.",
    );
    expect(noteAgrees("Names the production site.", true)).toBe("Names the production site.");
  });
});
