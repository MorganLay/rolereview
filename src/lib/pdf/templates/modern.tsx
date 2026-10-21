import { ResumeDocument } from "../document";
import type { ResumePdfModel } from "../model";

export function ModernResume({ model }: { model: ResumePdfModel }) {
  return <ResumeDocument model={model} variant="modern" />;
}
