/**
 * Included letter content in export order, for every PDF template.
 * docs/02-USER-FLOWS.md → Cover letter workspace.
 */

import { letterBlocks } from "@/features/letters/plainText";
import type { CoverLetterContent } from "@/features/letters/schemas";

export type LetterPdfModel = {
  blocks: string[];
};

export function letterPdfModel(content: CoverLetterContent): LetterPdfModel {
  return { blocks: letterBlocks(content) };
}

/** Reading order. The PDF renders these strings and nothing else. */
export function letterPdfLines(model: LetterPdfModel): string[] {
  return [...model.blocks];
}
