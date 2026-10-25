import type { PdfDensity } from "../document";
import { ResumeDocument } from "../document";
import type { ResumePdfModel } from "../model";

export function ClassicResume({
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
      variant="classic"
      density={density}
      producedAt={producedAt}
    />
  );
}
