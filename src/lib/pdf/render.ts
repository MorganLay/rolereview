import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import { ensurePdfFonts } from "./fonts";
import type { ResumePdfModel } from "./model";
import type { ResumeTemplateId } from "./template";
import { ClassicResume } from "./templates/classic";
import { CompactResume } from "./templates/compact";
import { ModernResume } from "./templates/modern";

const TEMPLATES = {
  classic: ClassicResume,
  modern: ModernResume,
  compact: CompactResume,
} as const;

export async function renderResumePdf(
  model: ResumePdfModel,
  template: ResumeTemplateId,
): Promise<Buffer> {
  ensurePdfFonts();
  const element = createElement(TEMPLATES[template], { model });
  // react-pdf renders the template function down to Document. The public type only accepts Document.
  return renderToBuffer(element as ReactElement<DocumentProps>);
}
