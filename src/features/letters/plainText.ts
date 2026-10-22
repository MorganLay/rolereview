/**
 * Plain-text cover letter for application forms.
 * Included paragraphs only. No RoleRefine branding.
 * docs/02-USER-FLOWS.md → Cover letter workspace.
 */

import type { CoverLetterContent } from "./schemas";

/** Greeting, included paragraphs, closing, then signature. */
export function letterPlainText(content: CoverLetterContent): string {
  return letterBlocks(content).join("\n\n");
}

/** Words in the exported letter. */
export function letterWordCount(content: CoverLetterContent): number {
  const text = letterPlainText(content).trim();
  if (text.length === 0) return 0;
  return text.split(/\s+/).length;
}

export function letterBlocks(content: CoverLetterContent): string[] {
  const blocks: string[] = [];
  const greeting = clean(content.greeting);
  if (greeting) blocks.push(greeting);

  for (const paragraph of content.paragraphs) {
    if (!paragraph.included) continue;
    const text = clean(paragraph.text);
    if (text) blocks.push(text);
  }

  const closing = clean(content.closing);
  if (closing) blocks.push(closing);

  const signature = clean(content.signature);
  if (signature) blocks.push(signature);

  return blocks;
}

function clean(value: string): string | null {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length === 0 ? null : trimmed;
}
