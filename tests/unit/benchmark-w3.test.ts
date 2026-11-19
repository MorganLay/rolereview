import { describe, expect, it } from "vitest";

import type { LibrarySnapshot } from "@/features/library/schemas";
import type { TailorOutput } from "@/features/tailor/schemas";

import { applyCoveragePage } from "../../benchmarks/write-verify/coverage";
import { auditImport } from "../../benchmarks/write-verify/import-audit";
import { parseTitleDates } from "../../benchmarks/write-verify/import-dates";
import { writeVerifyW3Prompt } from "../../benchmarks/write-verify/prompt";
import { flattenCredentials, headingFromEntry } from "../../benchmarks/write-verify/w3-display";
import { stripPlaceholders } from "../../benchmarks/write-verify/w3-defects";

describe("W3 library and page rules", () => {
  it("adds the bullet example and the one-page rule", () => {
    const prompt = writeVerifyW3Prompt();
    expect(prompt).toContain("Created licensed kids' art and prepared tech packs as senior graphic designer.");
    expect(prompt).toContain("Target one page.");
    expect(prompt).toContain("Never a title the source does not state.");
  });

  it("copies a date range from a title into the date fields", () => {
    const snapshot = library({ title: "Accountant (2010–2013)", startDate: null });
    const dated = parseTitleDates(snapshot);
    expect(dated.parsed).toHaveLength(1);
    expect(dated.snapshot.entries[0]?.startDate).toBe("2010");
    expect(dated.snapshot.entries[0]?.endDate).toBe("2013");
    expect(dated.snapshot.entries[0]?.isCurrent).toBe(false);
  });

  it("uses a title the entry text states when the stored title is not a job title", () => {
    const entry = library({ title: "7+ yrs maintenance", startDate: "2004" }).entries[0];
    if (!entry) throw new Error("missing entry");
    entry.bullets = [{ ref: "B1", id: "B1", text: "lead mechanic managing 4 techs" }];
    expect(headingFromEntry(entry)).toBe("Lead Mechanic");
  });

  it("prints each credential on its own line", () => {
    const section = {
      heading: "Education",
      entries: [
        {
          title: "M.A. in Math Education, Southwestern University",
          meta: null,
          detail: null,
          dates: null,
          url: null,
          bullets: ["M.A. in Education, Philippine Normal University (2000); B.A. in Secondary Education, Cum Laude (1994)"],
        },
      ],
    };
    flattenCredentials(section);
    expect(section.entries.map((entry) => entry.title)).toEqual([
      "M.A. in Math Education, Southwestern University",
      "M.A. in Education, Philippine Normal University (2000)",
      "B.A. in Secondary Education, Cum Laude (1994)",
    ]);
    expect(section.entries.every((entry) => entry.bullets.length === 0)).toBe(true);
  });

  it("refuses an add that would pass one page unless a weaker line is named", () => {
    const draft = {
      summary: "",
      entries: [{ ref: "E1", bullets: [{ text: "Kept the close.", sourceRefs: ["B1"] }] }],
      skills: [],
      requirementMatches: [],
    } as TailorOutput;
    const refused = applyCoveragePage(draft, [{ decision: "add", ref: "E1", text: "Added a line.", replaces: "" }], 2);
    expect(refused.applied).toHaveLength(0);
    expect(refused.draft.entries[0]?.bullets).toHaveLength(1);
    const replaced = applyCoveragePage(
      draft,
      [{ decision: "replace", ref: "E1", text: "Added a line.", replaces: "Kept the close." }],
      2,
    );
    expect(replaced.applied).toEqual(["replace:Kept the close."]);
    expect(replaced.draft.entries[0]?.bullets.map((bullet) => bullet.text)).toEqual(["Added a line."]);
  });

  it("lists a role with no usable title and strips placeholder lines", () => {
    const snapshot = library({ title: "7+ yrs maintenance", startDate: "2010" });
    const errors = auditImport("Lead work 2010–2016 on conveyors.", snapshot);
    expect(errors.some((error) => error.kind === "untitled-role")).toBe(true);
    const stripped = stripPlaceholders("CANDIDATE NAME\n[Contact details withheld]\nSummary\nTaught math.");
    expect(stripped.removed).toEqual(["CANDIDATE NAME", "[Contact details withheld]"]);
    expect(stripped.text).toContain("Taught math.");
  });
});

function library(input: { title: string; startDate: string | null }): LibrarySnapshot {
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
        organization: null,
        location: null,
        startDate: input.startDate,
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [],
      },
    ],
    skills: [],
  };
}
