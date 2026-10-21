import { ResumeDocument } from "../document";
import type { ResumePdfModel } from "../model";

export function CompactResume({ model }: { model: ResumePdfModel }) {
  return <ResumeDocument model={model} variant="compact" />;
}
