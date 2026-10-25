/**
 * Cover letter DOCX from the same model as the PDF. No RoleRefine branding.
 * docs/03-ARCHITECTURE.md → Exports. docs/02-USER-FLOWS.md → Cover letter workspace.
 */

import { Paragraph, TextRun, type FileChild } from "docx";

import type { LetterPdfModel } from "@/lib/pdf/letter-model";

import { packDocx } from "./file";

export async function renderLetterDocx(
  model: LetterPdfModel,
  producedAt?: Date,
): Promise<Buffer> {
  return packDocx(
    letterDocxChildren(model),
    {
      top: 0.75,
      bottom: 0.75,
      left: 1,
      right: 1,
    },
    producedAt,
  );
}

function letterDocxChildren(model: LetterPdfModel): FileChild[] {
  return model.blocks.map((block, index) => {
    const last = index === model.blocks.length - 1;
    return new Paragraph({
      spacing: { after: last ? 0 : 240 },
      children: [new TextRun({ text: block, bold: last })],
    });
  });
}
