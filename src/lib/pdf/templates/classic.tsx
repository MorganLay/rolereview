import { ResumeDocument } from "../document";
import type { ResumePdfModel } from "../model";

export function ClassicResume({ model }: { model: ResumePdfModel }) {
  return <ResumeDocument model={model} variant="classic" />;
}
