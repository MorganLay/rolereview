import type { PdfDensity } from "../document";
import { ResumeDocument } from "../document";
import type { ResumePdfModel } from "../model";

export function ClassicResume({
  model,
  density = "regular",
}: {
  model: ResumePdfModel;
  density?: PdfDensity;
}) {
  return <ResumeDocument model={model} variant="classic" density={density} />;
}
