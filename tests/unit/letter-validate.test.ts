import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import { LETTER_LIMITS } from "@/features/letters/schemas";
import type { LetterOutput } from "@/features/letters/schemas";
import { validateLetterOutput } from "@/features/letters/validate";
import type { LetterGuardInput } from "@/features/letters/validate";

import { librarySnapshot } from "./tailor-fixture";

const POSTING = "The role needs Python and 5 years of reporting.";

function letter(overrides: Partial<LetterOutput> = {}): LetterOutput {
  return {
    greeting: "Hello there,",
    paragraphs: [
      {
        text: "I maintained 14 reports for a 20-person team.",
        sourceRefs: ["E1.B1"],
      },
      {
        text: "I cut prep time from 2 days to 3 hours.",
        sourceRefs: ["E1.B2"],
      },
      {
        text: "The posting asks for Python.",
        sourceRefs: ["POSTING"],
      },
    ],
    closing: "Best regards,",
    requirementIdsAddressed: ["r1"],
    ...overrides,
  };
}

function guard(
  output: LetterOutput,
  overrides: Partial<LetterGuardInput> = {},
) {
  return validateLetterOutput(output, {
    snapshot: librarySnapshot(),
    posting: POSTING,
    whyCompany: null,
    requirementIds: ["r1", "r2"],
    ...overrides,
  });
}

describe("validateLetterOutput", () => {
  it("keeps a grounded letter and leaves the closing alone", () => {
    const result = guard(letter({ closing: "Thanks for the 9 years," }));

    expect(result.reverts).toBe(0);
    expect(result.issues).toEqual([]);
    expect(result.output.closing).toBe("Thanks for the 9 years,");
    expect(result.output.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "I maintained 14 reports for a 20-person team.",
      "I cut prep time from 2 days to 3 hours.",
      "The posting asks for Python.",
    ]);
    expect(result.output.paragraphs.every((paragraph) => !paragraph.reverted)).toBe(
      true,
    );
    expect(result.output.paragraphs.every((paragraph) => !paragraph.needsWhy)).toBe(
      true,
    );
    expect(result.output.requirementIdsAddressed).toEqual(["r1"]);
  });

  it("does not change the output it was given", () => {
    const output = letter();
    const before = structuredClone(output);

    guard(output);

    expect(output).toEqual(before);
  });

  it("keeps the needs-why line for the workspace", () => {
    expect(strings.jobs.letters.needsWhy).toBe(
      "Add your own reasons to strengthen this",
    );
  });

  it("drops an unknown ref and keeps the paragraph when another ref remains", () => {
    const output = letter();
    output.paragraphs[0] = {
      text: "I maintained 14 reports for a 20-person team.",
      sourceRefs: ["E99", "E1.B1", "E1.B1", "POSTING"],
    };

    const result = guard(output);

    expect(result.output.paragraphs[0]?.sourceRefs).toEqual(["E1.B1", "POSTING"]);
    expect(result.issues).toEqual([{ code: "L1", ref: "E99" }]);
  });

  it("drops a middle paragraph left with no refs and keeps the ends", () => {
    const result = guard(
      letter({
        paragraphs: [
          { text: "I am glad to apply.", sourceRefs: ["E99"] },
          { text: "This line cites nothing real.", sourceRefs: ["nope"] },
          { text: "I would like to talk.", sourceRefs: [] },
        ],
      }),
    );

    expect(result.output.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "I am glad to apply.",
      "I would like to talk.",
    ]);
    expect(result.output.paragraphs[0]?.sourceRefs).toEqual([]);
    expect(result.issues).toEqual([
      { code: "L1", ref: "E99" },
      { code: "L1", ref: "nope" },
      { code: "L1", ref: "p1" },
    ]);
  });

  it("keeps a single paragraph even when every ref is unknown", () => {
    const result = guard(
      letter({
        paragraphs: [{ text: "I am glad to apply.", sourceRefs: ["posting"] }],
      }),
    );

    expect(result.output.paragraphs).toEqual([
      {
        text: "I am glad to apply.",
        sourceRefs: [],
        reverted: false,
        needsWhy: false,
      },
    ]);
    expect(result.issues).toEqual([{ code: "L1", ref: "posting" }]);
  });

  it("drops one sentence with a new number and counts the paragraph once", () => {
    const output = letter();
    output.paragraphs[0] = {
      text: "I maintained 14 reports. I hired 9 people. I kept a 20-person team.",
      sourceRefs: ["E1.B1"],
    };

    const result = guard(output);

    expect(result.reverts).toBe(1);
    expect(result.output.paragraphs[0]).toEqual({
      text: "I maintained 14 reports. I kept a 20-person team.",
      sourceRefs: ["E1.B1"],
      reverted: true,
      needsWhy: false,
    });
    expect(result.issues).toEqual([{ code: "L2", ref: "p0" }]);
  });

  it("counts one revert when every sentence in two paragraphs loses a number", () => {
    const result = guard(
      letter({
        paragraphs: [
          {
            text: "I hired 9 people. I opened 8 offices.",
            sourceRefs: ["E1.B1"],
          },
          {
            text: "I saved $50. I managed 4 budgets.",
            sourceRefs: ["E1.B2"],
          },
          { text: "The posting asks for Python.", sourceRefs: ["POSTING"] },
        ],
      }),
    );

    expect(result.reverts).toBe(2);
    expect(result.output.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "The posting asks for Python.",
    ]);
    expect(result.issues.map((issue) => issue.code)).toEqual(["L2", "L2"]);
  });

  it("treats grouped digits, money, and percents the way the resume guard does", () => {
    const snapshot = librarySnapshot();
    const bullet = snapshot.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = "Handled 1,000 rows, saved $50, and cut waste by 20%.";

    const passed = guard(
      letter({
        paragraphs: [
          {
            text: "I handled 1000 rows and saved $50, a 20 % cut.",
            sourceRefs: ["E1.B1"],
          },
        ],
      }),
      { snapshot },
    );
    const bareAmount = guard(
      letter({
        paragraphs: [{ text: "I handled 50 rows.", sourceRefs: ["E1.B1"] }],
      }),
      { snapshot },
    );
    const barePercent = guard(
      letter({
        paragraphs: [{ text: "I cut waste by 20.", sourceRefs: ["E1.B1"] }],
      }),
      { snapshot },
    );

    expect(passed.reverts).toBe(0);
    expect(passed.output.paragraphs[0]?.text).toBe(
      "I handled 1000 rows and saved $50, a 20 % cut.",
    );
    expect(bareAmount.reverts).toBe(1);
    expect(bareAmount.output.paragraphs).toEqual([]);
    expect(barePercent.output.paragraphs).toEqual([]);
  });

  it("allows a posting number only on a paragraph that cites POSTING", () => {
    const result = guard(
      letter({
        paragraphs: [
          { text: "The role needs 5 years.", sourceRefs: ["E1.B1"] },
          { text: "The role needs 5 years.", sourceRefs: ["POSTING"] },
          { text: "I would like to talk.", sourceRefs: ["POSTING"] },
        ],
      }),
    );

    expect(result.output.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "The role needs 5 years.",
      "I would like to talk.",
    ]);
    expect(result.reverts).toBe(1);
  });

  it("keeps a decimal as one sentence and one number", () => {
    const result = guard(
      letter({
        paragraphs: [
          {
            text: "The posting names version 3.14.",
            sourceRefs: ["POSTING"],
          },
        ],
      }),
      { posting: "Use version 3.14." },
    );

    expect(result.reverts).toBe(0);
    expect(result.output.paragraphs[0]?.text).toBe(
      "The posting names version 3.14.",
    );
  });

  it("allows a date on the entry ref and not on the bullet alone", () => {
    const onEntry = guard(
      letter({
        paragraphs: [{ text: "I graduated in 2023.", sourceRefs: ["E3"] }],
      }),
    );
    const onBullet = guard(
      letter({
        paragraphs: [{ text: "I graduated in 2023.", sourceRefs: ["E3.B1"] }],
      }),
    );

    expect(onEntry.reverts).toBe(0);
    expect(onEntry.output.paragraphs[0]?.text).toBe("I graduated in 2023.");
    expect(onBullet.reverts).toBe(1);
    expect(onBullet.output.paragraphs).toEqual([]);
  });

  it("allows a number in a skill name only when that skill is cited", () => {
    const snapshot = librarySnapshot();
    const skill = snapshot.skills[0];
    if (!skill) throw new Error("missing skill");
    skill.name = "Excel 365";

    const cited = guard(
      letter({
        paragraphs: [{ text: "I use Excel 365.", sourceRefs: ["S1"] }],
      }),
      { snapshot },
    );
    const missed = guard(
      letter({
        paragraphs: [{ text: "I use Excel 365.", sourceRefs: ["E2.B1"] }],
      }),
      { snapshot },
    );

    expect(cited.reverts).toBe(0);
    expect(missed.output.paragraphs).toEqual([]);
  });

  it("does not split an abbreviation away from the number that follows", () => {
    const result = guard(
      letter({
        paragraphs: [
          {
            text: "Dr. Smith led 9 people.",
            sourceRefs: ["E1.B1"],
          },
          {
            text: "I maintained 14 reports, e.g. across 9 teams.",
            sourceRefs: ["E1.B1"],
          },
          { text: "I would like to talk.", sourceRefs: ["E1.B2"] },
        ],
      }),
    );

    expect(result.output.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "I would like to talk.",
    ]);
    expect(result.reverts).toBe(2);
  });

  it("flags a motivation paragraph when WHY was the only source and no note was given", () => {
    const result = guard(
      letter({
        paragraphs: [
          { text: "I maintained 14 reports.", sourceRefs: ["E1.B1"] },
          { text: "I am interested in the work.", sourceRefs: ["WHY"] },
          { text: "I would like to talk.", sourceRefs: ["POSTING"] },
        ],
      }),
    );

    expect(result.output.paragraphs[1]).toEqual({
      text: "I am interested in the work.",
      sourceRefs: [],
      reverted: false,
      needsWhy: true,
    });
    expect(result.issues).toEqual([{ code: "L3", ref: "p1" }]);
  });

  it("removes WHY and keeps the other refs when a note is missing", () => {
    const result = guard(
      letter({
        paragraphs: [
          {
            text: "I maintained 14 reports and like this work.",
            sourceRefs: ["WHY", "E1.B1"],
          },
        ],
      }),
      { whyCompany: "   " },
    );

    expect(result.output.paragraphs[0]).toEqual({
      text: "I maintained 14 reports and like this work.",
      sourceRefs: ["E1.B1"],
      reverted: false,
      needsWhy: false,
    });
    expect(result.issues).toEqual([{ code: "L3", ref: "p0" }]);
  });

  it("keeps WHY when the note is present and checks numbers against it", () => {
    const kept = guard(
      letter({
        paragraphs: [
          { text: "I can start in 2 weeks.", sourceRefs: ["WHY"] },
        ],
      }),
      { whyCompany: "I can start in 2 weeks." },
    );
    const dropped = guard(
      letter({
        paragraphs: [{ text: "I can start in 2 weeks.", sourceRefs: ["WHY"] }],
      }),
      { whyCompany: "The work matches my library." },
    );

    expect(kept.reverts).toBe(0);
    expect(kept.output.paragraphs[0]?.sourceRefs).toEqual(["WHY"]);
    expect(kept.output.paragraphs[0]?.needsWhy).toBe(false);
    expect(dropped.output.paragraphs).toEqual([]);
    expect(dropped.reverts).toBe(1);
  });

  it("drops a motivation sentence that invents a number", () => {
    const result = guard(
      letter({
        paragraphs: [
          { text: "Their team of 12 inspired me.", sourceRefs: ["WHY"] },
        ],
      }),
    );

    expect(result.output.paragraphs).toEqual([]);
    expect(result.reverts).toBe(1);
    expect(result.issues).toEqual([
      { code: "L3", ref: "p0" },
      { code: "L2", ref: "p0" },
    ]);
  });

  it("filters requirement ids to real ones and keeps the first of each", () => {
    const result = guard(
      letter({ requirementIdsAddressed: ["r1", "r9", "r1", "r2"] }),
    );

    expect(result.output.requirementIdsAddressed).toEqual(["r1", "r2"]);
    expect(result.issues).toEqual([{ code: "L4", ref: "r9" }]);
  });

  it("drops a blank paragraph without a revert", () => {
    const result = guard(
      letter({
        paragraphs: [
          { text: "   ", sourceRefs: ["E99"] },
          { text: "I maintained 14 reports.", sourceRefs: ["E1.B1"] },
        ],
      }),
    );

    expect(result.reverts).toBe(0);
    expect(result.output.paragraphs).toHaveLength(1);
    expect(result.issues).toEqual([{ code: "L1", ref: "E99" }]);
  });

  it("does not put paragraph text on an issue", () => {
    const secret = "UNIQUE_SENTENCE_SHOULD_NOT_LEAK";
    const result = guard(
      letter({
        paragraphs: [
          { text: `${secret} 9 times.`, sourceRefs: ["E1.B1"] },
        ],
        closing: secret,
      }),
    );

    expect(JSON.stringify(result.issues)).not.toContain(secret);
    expect(result.output.paragraphs).toEqual([]);
    expect(result.output.closing).toBe(secret);
    expect(secret.length).toBeLessThan(LETTER_LIMITS.closing);
  });
});
