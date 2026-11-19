import { describe, expect, it } from "vitest";

import type { ResumeContent } from "@/features/tailor/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";

import { applyCut } from "../../benchmarks/write-verify/cut";
import { libraryDiff } from "../../benchmarks/write-verify/library-diff";
import { writeVerifyPrompt } from "../../benchmarks/write-verify/prompt";

describe("W2.1 prompt and page cut", () => {
  it("keeps the three added writing rules", () => {
    const prompt = writeVerifyPrompt();
    expect(prompt).toContain("', demonstrating strong organization and planning'");
    expect(prompt).toContain("'with discretion'");
    expect(prompt).toContain("'to keep daily office operations running'");
    expect(prompt).toContain("', welcoming feedback from supervisors'");
    expect(prompt).toContain("'Brings strong organizational skills'");
    expect(prompt).toContain("It is not a job title the candidate has not held.");
    expect(prompt).toContain("Never let a field, school or year from one degree attach to another.");
  });

  it("refuses a merge that adds a number and caps a large drop", () => {
    const content = {
      entries: [
        {
          ref: "E1",
          included: true,
          bullets: [
            { id: "a", text: "Raised availability from 84% to 92%.", included: true, sourceRefs: ["B1"] },
            { id: "b", text: "Cut downtime by 8%.", included: true, sourceRefs: ["B2"] },
          ],
        },
      ],
    } as ResumeContent;
    const refused = applyCut(content, {
      drop: [],
      merge: [{ ids: ["a", "b"], text: "Raised availability from 84% to 99% and cut downtime by 8%." }],
    });
    expect(refused.log.merged).toHaveLength(0);
    expect(refused.log.refused.length).toBeGreaterThan(0);
    expect(refused.content.entries[0]?.bullets.every((bullet) => bullet.included)).toBe(true);

    const capped = applyCut(content, { drop: ["a", "b"], merge: [] });
    const off = capped.content.entries[0]?.bullets.filter((bullet) => !bullet.included) ?? [];
    expect(off).toHaveLength(1);
  });

  it("lists library lines that do not match", () => {
    const adapter = library({
      title: "Accountant",
      organization: "Clinic",
      startDate: "2010",
      bullets: ["Managed revenue."],
      skills: ["QuickBooks"],
    });
    const imported = library({
      title: "Accountant",
      organization: "Clinic",
      startDate: "2011",
      bullets: ["Posted journal entries."],
      skills: ["ADP"],
    });
    const diff = libraryDiff(adapter, imported);
    expect(diff.bulletsOnlyAdapter).toEqual(["Managed revenue."]);
    expect(diff.bulletsOnlyImport).toEqual(["Posted journal entries."]);
    expect(diff.skillsOnlyAdapter).toEqual(["QuickBooks"]);
    expect(diff.skillsOnlyImport).toEqual(["ADP"]);
    expect(diff.dates[0]?.adapter).toContain("2010");
    expect(diff.dates[0]?.imported).toContain("2011");
  });
});

function library(input: {
  title: string;
  organization: string;
  startDate: string;
  bullets: string[];
  skills: string[];
}): LibrarySnapshot {
  return {
    takenAt: "2026-11-15T00:00:00.000Z",
    profile: {
      fullName: null,
      headline: null,
      email: "",
      phone: null,
      location: null,
      links: [],
      summary: null,
    },
    entries: [
      {
        ref: "E1",
        id: "E1",
        kind: "EXPERIENCE",
        title: input.title,
        organization: input.organization,
        location: null,
        startDate: input.startDate,
        endDate: null,
        isCurrent: true,
        url: null,
        bullets: input.bullets.map((text, index) => ({ ref: `B${index + 1}`, id: `B${index + 1}`, text })),
      },
    ],
    skills: input.skills.map((name, index) => ({ ref: `S${index + 1}`, id: `S${index + 1}`, name, category: null })),
  };
}
