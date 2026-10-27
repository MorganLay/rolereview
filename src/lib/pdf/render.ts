import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import type { PdfLayout } from "./document";
import { ensurePdfFonts } from "./fonts";
import { LetterDocument } from "./letter";
import type { LetterPdfModel } from "./letter-model";
import type { ResumePdfModel } from "./model";
import { linesAfterFirstPage } from "./overflow";
import { pdfPageCount } from "./pages";
import type { ResumeTemplateId } from "./template";
import { ClassicResume } from "./templates/classic";
import { CompactResume } from "./templates/compact";
import { ModernResume } from "./templates/modern";

const TEMPLATES = {
  classic: ClassicResume,
  modern: ModernResume,
  compact: CompactResume,
} as const;

export type FitStep = "regular" | "compact" | "links" | "minimum";

export type FitLayout = PdfLayout & { step: FitStep };

/**
 * Tighten steps after a regular 1-page render spills.
 * 1. Compact spacing: tight padding and gaps, regular type, links still stacked.
 * 2. Contact links on one line: the same spacing, with the grouped contact row.
 * 3. Font at the template minimum: the tighter density, which holds the smallest fontSize.
 */
export const ONE_PAGE_FIT_STEPS: readonly FitLayout[] = [
  { step: "compact", spacing: "tight", type: "regular", groupLinks: false },
  { step: "links", spacing: "tight", type: "regular", groupLinks: true },
  { step: "minimum", spacing: "tighter", type: "tighter", groupLinks: true },
];

const REGULAR_FIT: FitLayout = {
  step: "regular",
  spacing: "regular",
  type: "regular",
  groupLinks: false,
};

export type ResumePdfOptions = {
  /** 1 keeps the PDF on a single Letter page by tightening the layout. */
  pages?: 1 | 2;
  /** Stable PDF timestamp. A submitted version passes `submittedAt`. */
  producedAt?: Date;
};

export type ResumePdfFit = {
  pdf: Buffer;
  /** `pdfPageCount` of `pdf`. Preview uses that same function on these bytes. */
  pageCount: number;
  /** Positive when a 1-page target is still over one page. Otherwise 0. */
  overByLines: number;
  step: FitStep;
};

export async function renderResumePdf(
  model: ResumePdfModel,
  template: ResumeTemplateId,
  options?: ResumePdfOptions,
): Promise<Buffer> {
  const fit = await fitResumePdf(model, template, options);
  return fit.pdf;
}

/** Same bytes the download route returns. Preview reads `pageCount` from those bytes. */
export async function fitResumePdf(
  model: ResumePdfModel,
  template: ResumeTemplateId,
  options?: ResumePdfOptions,
): Promise<ResumePdfFit> {
  ensurePdfFonts();
  const targetOne = options?.pages === 1;
  const regular = await renderFitLayout(model, template, REGULAR_FIT, options?.producedAt);
  const regularPages = pdfPageCount(regular);
  if (!targetOne || regularPages <= 1) {
    return { pdf: regular, pageCount: regularPages, overByLines: 0, step: "regular" };
  }

  let last = regular;
  let lastStep: FitStep = "regular";
  for (const layout of ONE_PAGE_FIT_STEPS) {
    last = await renderFitLayout(model, template, layout, options?.producedAt);
    lastStep = layout.step;
    const pages = pdfPageCount(last);
    if (pages <= 1) {
      return { pdf: last, pageCount: pages, overByLines: 0, step: layout.step };
    }
  }

  const pageCount = pdfPageCount(last);
  return {
    pdf: last,
    pageCount,
    overByLines: overflowLines(last, pageCount),
    step: lastStep,
  };
}

export async function renderFitLayout(
  model: ResumePdfModel,
  template: ResumeTemplateId,
  layout: PdfLayout,
  producedAt?: Date,
): Promise<Buffer> {
  ensurePdfFonts();
  const element = createElement(TEMPLATES[template], { model, layout, producedAt });
  // react-pdf renders the template function down to Document. The public type only accepts Document.
  return renderToBuffer(element as ReactElement<DocumentProps>);
}

/**
 * Text operators on pages after the first.
 * When the streams cannot be read, one line per extra page (at least 1).
 */
function overflowLines(pdf: Buffer, pageCount: number): number {
  if (pageCount <= 1) return 0;
  const parsed = linesAfterFirstPage(pdf);
  if (parsed > 0) return parsed;
  return Math.max(1, pageCount - 1);
}

export async function renderLetterPdf(
  model: LetterPdfModel,
  template: ResumeTemplateId,
  producedAt?: Date,
): Promise<Buffer> {
  ensurePdfFonts();
  const element = createElement(LetterDocument, { model, variant: template, producedAt });
  return renderToBuffer(element as ReactElement<DocumentProps>);
}
