import mammoth from "mammoth";
import { describe, expect, it } from "vitest";

import type { CoverLetterContent } from "@/features/letters/schemas";
import { renderLetterDocx } from "@/lib/docx/letter";
import { renderResumeDocx } from "@/lib/docx/resume";
import { letterPdfLines, letterPdfModel } from "@/lib/pdf/letter-model";
import { resumePdfLines, resumePdfModel } from "@/lib/pdf/model";

import {
  contentBullet,
  librarySnapshot,
  resumeContent,
} from "./tailor-fixture";

describe("renderResumeDocx", () => {
  it("keeps the same reading order as the PDF and drops excluded lines", async () => {
    const model = resumePdfModel(sample(), librarySnapshot());
    const buffer = await renderResumeDocx(model);
    const text = await extractText(buffer);

    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(text).not.toMatch(/RoleRefine/i);
    expect(text).not.toContain("Left off.");
    expect(text).not.toContain("Not in the snapshot.");
    expect(text).not.toContain("Shelved returns");
    expectLinesInOrder(text, resumePdfLines(model));
  });

  it("renders an empty model as a valid document", async () => {
    const buffer = await renderResumeDocx({
      name: null,
      headline: null,
      contact: null,
      links: [],
      summary: null,
      sections: [],
      skills: [],
    });
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    const text = await extractText(buffer);
    expect(text).not.toMatch(/RoleRefine/i);
  });
});

describe("renderLetterDocx", () => {
  it("matches copy-text order and drops excluded paragraphs", async () => {
    const model = letterPdfModel(sampleLetter());
    const buffer = await renderLetterDocx(model);
    const text = await extractText(buffer);

    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(text).not.toMatch(/RoleRefine/i);
    expect(text).not.toContain("Left off.");
    expectLinesInOrder(text, letterPdfLines(model));
  });
});

async function extractText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function expectLinesInOrder(extracted: string, lines: string[]) {
  const haystack = extracted.replace(/\s+/g, " ");
  let from = 0;
  for (const line of lines) {
    const needle = (line.startsWith("- ") ? line.slice(2) : line)
      .replace(/\s+/g, " ")
      .trim();
    const idx = haystack.indexOf(needle, from);
    expect(idx, needle).toBeGreaterThanOrEqual(0);
    from = idx + needle.length;
  }
}

function sampleLetter(): CoverLetterContent {
  return {
    schemaVersion: 1,
    greeting: "Dear Hiring Manager,",
    paragraphs: [
      {
        id: "p1",
        text: "I maintained 14 reports.",
        included: true,
        sourceRefs: ["E1.B1"],
        reverted: false,
        edited: false,
        needsWhy: false,
      },
      {
        id: "p2",
        text: "Left off.",
        included: false,
        sourceRefs: ["POSTING"],
        reverted: false,
        edited: false,
        needsWhy: false,
      },
    ],
    closing: "Sincerely,",
    signature: "Morgan Example",
    requirementIdsAddressed: ["r1"],
  };
}

function sample() {
  return resumeContent({
    summary: { text: "Analyst with reporting experience.", included: true },
    entries: [
      {
        ref: "E2",
        kind: "PROJECT",
        included: true,
        bullets: [
          contentBullet({
            id: "p1",
            text: "Wrote a Python bot\nthat booked rooms.",
          }),
        ],
      },
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [
          contentBullet({
            id: "e1",
            text: "Maintained 14 reports for a 20-person team.",
          }),
          contentBullet({
            id: "e2",
            text: "Left off.",
            included: false,
          }),
        ],
      },
      {
        ref: "E4",
        kind: "EXPERIENCE",
        included: false,
        bullets: [contentBullet({ id: "e4", text: "Shelved returns each morning." })],
      },
      {
        ref: "missing",
        kind: "EXPERIENCE",
        included: true,
        bullets: [contentBullet({ id: "gone", text: "Not in the snapshot." })],
      },
      {
        ref: "E3",
        kind: "EDUCATION",
        included: true,
        bullets: [contentBullet({ id: "ed", text: "Completed a compilers course." })],
      },
    ],
    skills: [
      { category: "Languages", names: ["Python", "SQL"] },
      { category: null, names: ["IBM Cognos"] },
      { category: "   ", names: ["  "] },
    ],
  });
}
