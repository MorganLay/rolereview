import { describe, expect, it } from "vitest";

import { assembleLetterContent } from "@/features/letters/assemble";
import {
  CoverLetterOptions,
  LETTER_LIMITS,
  type ValidatedLetterOutput,
} from "@/features/letters/schemas";

import { librarySnapshot } from "./tailor-fixture";

function ids() {
  let next = 1;
  return () => `id-${next++}`;
}

function validated(
  overrides: Partial<ValidatedLetterOutput> = {},
): ValidatedLetterOutput {
  return {
    paragraphs: [
      {
        text: "I maintained 14 reports.",
        sourceRefs: ["E1.B1"],
        reverted: true,
        needsWhy: false,
      },
      {
        text: "I am interested in the work.",
        sourceRefs: [],
        reverted: false,
        needsWhy: true,
      },
    ],
    closing: "Warmly,",
    requirementIdsAddressed: ["r1", "r2"],
    ...overrides,
  };
}

describe("assembleLetterContent", () => {
  it("builds the greeting, signature, and included paragraphs", () => {
    const content = assembleLetterContent(
      validated(),
      librarySnapshot(),
      { recipientName: "Ada\nLovelace" },
      ids(),
    );

    expect(content.schemaVersion).toBe(1);
    expect(content.greeting).toBe("Dear Ada Lovelace,");
    expect(content.closing).toBe("Warmly,");
    expect(content.signature).toBe("Morgan Example");
    expect(content.requirementIdsAddressed).toEqual(["r1", "r2"]);
    expect(content.paragraphs).toEqual([
      {
        id: "id-1",
        text: "I maintained 14 reports.",
        included: true,
        sourceRefs: ["E1.B1"],
        reverted: true,
        edited: false,
        needsWhy: false,
      },
      {
        id: "id-2",
        text: "I am interested in the work.",
        included: true,
        sourceRefs: [],
        reverted: false,
        edited: false,
        needsWhy: true,
      },
    ]);
  });

  it("uses Hiring Manager and Sincerely when the name and closing are blank", () => {
    const snapshot = librarySnapshot();
    snapshot.profile.fullName = null;

    const content = assembleLetterContent(
      validated({ closing: " \n " }),
      snapshot,
      { recipientName: "  " },
      ids(),
    );

    expect(content.greeting).toBe("Dear Hiring Manager,");
    expect(content.closing).toBe("Sincerely,");
    expect(content.signature).toBe("");
  });

  it("keeps a closing that contains a number", () => {
    const content = assembleLetterContent(
      validated({ closing: "Thanks for the 9 years," }),
      librarySnapshot(),
      {},
      ids(),
    );

    expect(content.greeting).toBe("Dear Hiring Manager,");
    expect(content.closing).toBe("Thanks for the 9 years,");
  });

  it("clips the recipient, the closing, the signature, and a paragraph", () => {
    const snapshot = librarySnapshot();
    snapshot.profile.fullName = "N".repeat(LETTER_LIMITS.signature + 5);
    const content = assembleLetterContent(
      validated({
        paragraphs: [
          {
            text: "P".repeat(LETTER_LIMITS.paragraph + 5),
            sourceRefs: ["E1.B1"],
            reverted: false,
            needsWhy: false,
          },
        ],
        closing: "C".repeat(LETTER_LIMITS.closing + 5),
      }),
      snapshot,
      { recipientName: "R".repeat(LETTER_LIMITS.recipientName + 5) },
      ids(),
    );

    expect(content.greeting).toBe(
      `Dear ${"R".repeat(LETTER_LIMITS.recipientName)},`,
    );
    expect(content.closing).toHaveLength(LETTER_LIMITS.closing);
    expect(content.signature).toHaveLength(LETTER_LIMITS.signature);
    expect(content.paragraphs[0]?.text).toHaveLength(LETTER_LIMITS.paragraph);
  });

  it("parses stored options with the documented defaults", () => {
    expect(CoverLetterOptions.parse({})).toEqual({
      tone: "professional",
      length: "standard",
    });
  });
});
