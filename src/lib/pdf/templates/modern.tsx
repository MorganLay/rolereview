import type { PdfDensity, PdfLayout } from "../document";
import { ResumeDocument } from "../document";
import type { ResumePdfModel } from "../model";

export function ModernResume({
  model,
  density = "regular",
  layout,
  producedAt,
}: {
  model: ResumePdfModel;
  density?: PdfDensity;
  layout?: PdfLayout;
  producedAt?: Date;
}) {
  return (
    <ResumeDocument
      model={model}
      variant="modern"
      density={density}
      layout={layout}
      producedAt={producedAt}
    />
  );
}
