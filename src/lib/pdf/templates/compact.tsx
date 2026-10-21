import type { PdfDensity } from "../document";
import { ResumeDocument } from "../document";
import type { ResumePdfModel } from "../model";

export function CompactResume({
  model,
  density = "regular",
}: {
  model: ResumePdfModel;
  density?: PdfDensity;
}) {
  return <ResumeDocument model={model} variant="compact" density={density} />;
}
