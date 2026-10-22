import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import { ensurePdfFonts } from "./fonts";
import { LetterDocument } from "./letter";
import type { LetterPdfModel } from "./letter-model";
import type { ResumePdfModel } from "./model";
import { pdfPageCount } from "./pages";
import type { ResumeTemplateId } from "./template";
import { ClassicResume } from "./templates/classic";
import { CompactResume } from "./templates/compact";
import { ModernResume } from "./templates/modern";
import type { PdfDensity } from "./document";

const TEMPLATES = {
  classic: ClassicResume,
  modern: ModernResume,
  compact: CompactResume,
} as const;

/** Densities tried, in order, when a 1-page tailor spills onto a second page. */
const ONE_PAGE_DENSITIES: readonly PdfDensity[] = [
  "regular",
  "grouped",
  "tight",
  "tighter",
];

export type ResumePdfOptions = {
  /** 1 keeps the PDF on a single Letter page by tightening the layout. */
  pages?: 1 | 2;
};

export async function renderResumePdf(
  model: ResumePdfModel,
  template: ResumeTemplateId,
  options?: ResumePdfOptions,
): Promise<Buffer> {
  ensurePdfFonts();
  const densities = options?.pages === 1 ? ONE_PAGE_DENSITIES : (["regular"] as const);
  let pdf: Buffer | null = null;
  for (const density of densities) {
    pdf = await renderDensity(model, template, density);
    if (options?.pages !== 1 || pdfPageCount(pdf) <= 1) return pdf;
  }
  return pdf as Buffer;
}

async function renderDensity(
  model: ResumePdfModel,
  template: ResumeTemplateId,
  density: PdfDensity,
): Promise<Buffer> {
  const element = createElement(TEMPLATES[template], { model, density });
  // react-pdf renders the template function down to Document. The public type only accepts Document.
  return renderToBuffer(element as ReactElement<DocumentProps>);
}

export async function renderLetterPdf(
  model: LetterPdfModel,
  template: ResumeTemplateId,
): Promise<Buffer> {
  ensurePdfFonts();
  const element = createElement(LetterDocument, { model, variant: template });
  return renderToBuffer(element as ReactElement<DocumentProps>);
}
