import { strings } from "@/copy/strings";
import type { ResumeTemplateId } from "@/lib/pdf/template";

const copy = strings.jobs.documents;

const LABELS: Record<ResumeTemplateId, string> = {
  classic: copy.templateClassic,
  modern: copy.templateModern,
  compact: copy.templateCompact,
};

/** Classic, Modern, or Compact. An unknown stored id reads as Classic. */
export function resumeTemplateLabel(templateId: string): string {
  if (templateId === "modern" || templateId === "compact" || templateId === "classic") {
    return LABELS[templateId];
  }
  return LABELS.classic;
}
