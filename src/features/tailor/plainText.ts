/**
 * Plain-text resume for application forms.
 * The same lines the PDF and DOCX print, in that order.
 * docs/05-AI.md → Plain text. Included content only, no RoleRefine branding.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";
import { resumePdfLines, resumePdfModel } from "@/lib/pdf/model";

import type { ResumeContent } from "./schemas";

export function resumePlainText(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): string {
  return resumePdfLines(resumePdfModel(content, snapshot)).join("\n");
}
