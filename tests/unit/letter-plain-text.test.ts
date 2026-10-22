import { describe, expect, it } from "vitest";

import { letterPlainText, letterWordCount } from "@/features/letters/plainText";
import type { CoverLetterContent, LetterParagraph } from "@/features/letters/schemas";

function paragraph(
  overrides: Partial<LetterParagraph> & Pick<LetterParagraph, "id" | "text">,
): LetterParagraph {
  return {
    included: true,
    sourceRefs: ["E1.B1"],
    reverted: false,
    edited: false,
    needsWhy: false,
    ...overrides,
  };
}

function letter(
  overrides: Partial<CoverLetterContent> = {},
): CoverLetterContent {
  return {
    schemaVersion: 1,
    greeting: "Dear Hiring Manager,",
    paragraphs: [
      paragraph({ id: "p1", text: "I maintained 14 reports." }),
      paragraph({ id: "p2", text: "I am interested in the work.", included: false }),
      paragraph({ id: "p3", text: "Thank you for your time." }),
    ],
    closing: "Sincerely,",
    signature: "Morgan Example",
    requirementIdsAddressed: ["r1"],
    ...overrides,
  };
}

describe("letterPlainText", () => {
  it("keeps greeting, included paragraphs, closing, then signature", () => {
    expect(letterPlainText(letter())).toBe(
      [
        "Dear Hiring Manager,",
        "I maintained 14 reports.",
        "Thank you for your time.",
        "Sincerely,",
        "Morgan Example",
      ].join("\n\n"),
    );
  });

  it("drops blank parts and excluded paragraphs", () => {
    expect(
      letterPlainText(
        letter({
          greeting: "  ",
          signature: "",
          paragraphs: [
            paragraph({ id: "p1", text: "  left in  " }),
            paragraph({ id: "p2", text: "out", included: false }),
          ],
        }),
      ),
    ).toBe(["left in", "Sincerely,"].join("\n\n"));
  });
});

describe("letterWordCount", () => {
  it("counts words in the exported letter", () => {
    expect(letterWordCount(letter())).toBe(15);
    expect(letterWordCount(letter({ greeting: "", paragraphs: [], closing: "", signature: "" }))).toBe(
      0,
    );
  });
});
