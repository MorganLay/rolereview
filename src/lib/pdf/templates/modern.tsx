import type { PdfDensity } from "../document";
import { ResumeDocument } from "../document";
import type { ResumePdfModel } from "../model";

export function ModernResume({
  model,
  density = "regular",
}: {
  model: ResumePdfModel;
  density?: PdfDensity;
}) {
  return <ResumeDocument model={model} variant="modern" density={density} />;
}
