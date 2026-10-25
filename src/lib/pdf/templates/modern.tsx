import type { PdfDensity } from "../document";
import { ResumeDocument } from "../document";
import type { ResumePdfModel } from "../model";

export function ModernResume({
  model,
  density = "regular",
  producedAt,
}: {
  model: ResumePdfModel;
  density?: PdfDensity;
  producedAt?: Date;
}) {
  return (
    <ResumeDocument
      model={model}
      variant="modern"
      density={density}
      producedAt={producedAt}
    />
  );
}
