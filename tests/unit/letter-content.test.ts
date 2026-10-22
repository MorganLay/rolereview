import { describe, expect, it } from "vitest";

import { applyLetterEdit } from "@/features/letters/content";
import type {
  CoverLetterContent,
  LetterParagraph,
  ValidatedLetterOutput,
} from "@/features/letters/schemas";

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

function stored(
  overrides: Partial<CoverLetterContent> = {},
): CoverLetterContent {
  return {
    schemaVersion: 1,
    greeting: "Dear Hiring Manager,",
    paragraphs: [
      paragraph({
        id: "p1",
        text: "I maintained 14 reports.",
        reverted: true,
        sourceRefs: ["E1.B1", "WHY"],
        needsWhy: true,
      }),
      paragraph({ id: "p2", text: "I am interested in the work." }),
    ],
    closing: "Sincerely,",
    signature: "Morgan Example",
    requirementIdsAddressed: ["r1", "r2"],
    ...overrides,
  };
}

function incoming(
  content: CoverLetterContent,
  overrides: Partial<CoverLetterContent> = {},
): CoverLetterContent {
  return {
    ...content,
    paragraphs: content.paragraphs.map((item) => ({ ...item })),
    requirementIdsAddressed: [...content.requirementIdsAddressed],
    ...overrides,
  };
}

function ai(): ValidatedLetterOutput {
  return {
    paragraphs: [
      {
        text: "I maintained 14 reports.",
        sourceRefs: ["E1.B1"],
        reverted: true,
        needsWhy: true,
      },
      {
        text: "I am interested in the work.",
        sourceRefs: ["POSTING"],
        reverted: false,
        needsWhy: false,
      },
    ],
    closing: "Sincerely,",
    requirementIdsAddressed: ["r1"],
  };
}

describe("applyLetterEdit", () => {
  it("keeps source refs, requirement ids, and needsWhy from storage", () => {
    const base = stored();
    const next = incoming(base, {
      greeting: "Dear Ms. Chen,",
      closing: "Warmly,",
      signature: "Morgan",
      paragraphs: [
        { ...base.paragraphs[0]!, text: "I maintained fourteen reports.", included: false },
        { ...base.paragraphs[1]!, text: "I am interested in the work." },
      ],
      requirementIdsAddressed: ["forged"],
    });

    const result = applyLetterEdit({ stored: base, incoming: next, aiOutput: ai() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.greeting).toBe("Dear Ms. Chen,");
    expect(result.content.closing).toBe("Warmly,");
    expect(result.content.signature).toBe("Morgan");
    expect(result.content.requirementIdsAddressed).toEqual(["r1", "r2"]);
    expect(result.content.paragraphs[0]).toMatchObject({
      id: "p1",
      included: false,
      sourceRefs: ["E1.B1", "WHY"],
      needsWhy: true,
      edited: true,
      reverted: false,
    });
  });

  it("marks a paragraph restored when the guarded text is back", () => {
    const base = stored({
      paragraphs: [
        paragraph({
          id: "p1",
          text: "I rewrote this.",
          reverted: false,
          edited: true,
        }),
      ],
    });
    const next = incoming(base, {
      paragraphs: [paragraph({ id: "p1", text: "I maintained 14 reports." })],
    });
    const result = applyLetterEdit({
      stored: base,
      incoming: next,
      aiOutput: {
        paragraphs: [
          {
            text: "I maintained 14 reports.",
            sourceRefs: ["E1.B1"],
            reverted: true,
            needsWhy: false,
          },
        ],
        closing: "Sincerely,",
        requirementIdsAddressed: [],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.paragraphs[0]).toMatchObject({
      text: "I maintained 14 reports.",
      edited: false,
      reverted: true,
    });
  });

  it("refuses a new paragraph, a blank greeting, and blank paragraph text", () => {
    const base = stored();
    expect(
      applyLetterEdit({
        stored: base,
        incoming: incoming(base, { greeting: "   " }),
        aiOutput: null,
      }).ok,
    ).toBe(false);
    expect(
      applyLetterEdit({
        stored: base,
        incoming: incoming(base, {
          paragraphs: [
            ...base.paragraphs,
            paragraph({ id: "p3", text: "Extra." }),
          ],
        }),
        aiOutput: null,
      }).ok,
    ).toBe(false);
    expect(
      applyLetterEdit({
        stored: base,
        incoming: incoming(base, {
          paragraphs: [
            { ...base.paragraphs[0]!, text: "  " },
            base.paragraphs[1]!,
          ],
        }),
        aiOutput: null,
      }).ok,
    ).toBe(false);
  });
});
