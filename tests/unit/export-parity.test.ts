import { describe, expect, it } from "vitest";

import type { CoverLetterContent } from "@/features/letters/schemas";
import { letterPlainText } from "@/features/letters/plainText";
import { resumePlainText } from "@/features/tailor/plainText";
import { docxDocumentText } from "@/lib/docx/text";
import { renderLetterDocx } from "@/lib/docx/letter";
import { renderResumeDocx } from "@/lib/docx/resume";
import { letterPdfLines, letterPdfModel } from "@/lib/pdf/letter-model";
import { resumePdfLines, resumePdfModel } from "@/lib/pdf/model";
import { renderLetterPdf, renderResumePdf } from "@/lib/pdf/render";

import { contentBullet, librarySnapshot, resumeContent } from "./tailor-fixture";

describe("export text parity", () => {
  it("uses the same resume lines in copy text, the PDF, and the DOCX", async () => {
    const content = resumeContent({
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
          ref: "E3",
          kind: "EDUCATION",
          included: true,
          bullets: [contentBullet({ id: "ed", text: "Completed a compilers course." })],
        },
      ],
      skills: [
        { category: "Languages", names: ["Python", "SQL"] },
        { category: null, names: ["IBM Cognos"] },
      ],
    });
    const snapshot = librarySnapshot();
    snapshot.profile.links.push({ label: "Script", url: "javascript:alert(1)" });
    const model = resumePdfModel(content, snapshot);
    const copyText = resumePlainText(content, snapshot);
    const pdfText = resumePdfLines(model).join("\n");
    const pdf = await renderResumePdf(model, "classic");
    const docx = docxDocumentText(await renderResumeDocx(model));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(comparable(copyText)).toBe(comparable(pdfText));
    expect(comparable(docx)).toBe(comparable(pdfText));
    expect(copyText).toContain("Maintained 14 reports for a 20-person team.");
    expect(docx).toContain("Maintained 14 reports for a 20-person team.");
    expect(copyText).not.toContain("Left off.");
    expect(docx).not.toContain("Left off.");
    expect(copyText).not.toContain("javascript:");
    expect(docx).not.toContain("RoleRefine");
  }, 20000);

  it("uses the same letter lines in copy text, the PDF, and the DOCX", async () => {
    const content = sampleLetter();
    const model = letterPdfModel(content);
    const copyText = letterPlainText(content);
    const pdfText = letterPdfLines(model).join("\n");
    const pdf = await renderLetterPdf(model, "classic");
    const docx = docxDocumentText(await renderLetterDocx(model));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(comparable(copyText)).toBe(comparable(pdfText));
    expect(comparable(docx)).toBe(comparable(pdfText));
    expect(copyText).toContain("I maintained 14 reports.");
    expect(docx).toContain("I maintained 14 reports.");
    expect(copyText).not.toContain("Left off.");
    expect(docx).not.toContain("RoleRefine");
  }, 20000);
});

function comparable(text: string): string {
  return text
    .replace(/\u00ad/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-•]\s+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
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
