/**
 * Turns a guarded letter into the editable cover letter.
 * docs/05-AI.md → COVER_LETTER. Greeting and signature come from the app.
 */

import { nanoid } from "nanoid";

import type { LibrarySnapshot } from "@/features/library/schemas";

import {
  CoverLetterContent,
  LETTER_LIMITS,
  type CoverLetterContent as CoverLetterContentData,
  type ValidatedLetterOutput,
} from "./schemas";

const DEFAULT_CLOSING = "Sincerely,";
const DEFAULT_RECIPIENT = "Hiring Manager";

export function assembleLetterContent(
  validated: ValidatedLetterOutput,
  snapshot: LibrarySnapshot,
  options: { recipientName?: string | null },
  createId: () => string = nanoid,
): CoverLetterContentData {
  return CoverLetterContent.parse({
    schemaVersion: 1,
    greeting: greetingFor(options.recipientName),
    paragraphs: validated.paragraphs.map((paragraph) => ({
      id: createId(),
      text: clip(paragraph.text, LETTER_LIMITS.paragraph),
      included: true,
      sourceRefs: paragraph.sourceRefs,
      reverted: paragraph.reverted,
      edited: false,
      needsWhy: paragraph.needsWhy,
    })),
    closing: closingFor(validated.closing),
    signature: clip(
      oneLine(snapshot.profile.fullName ?? ""),
      LETTER_LIMITS.signature,
    ),
    requirementIdsAddressed: validated.requirementIdsAddressed,
  });
}

function greetingFor(recipientName: string | null | undefined): string {
  const name = oneLine(recipientName ?? "");
  const recipient =
    name.length === 0
      ? DEFAULT_RECIPIENT
      : clip(name, LETTER_LIMITS.recipientName);
  return `Dear ${recipient},`;
}

function closingFor(closing: string): string {
  const line = oneLine(closing);
  if (line.length === 0) return DEFAULT_CLOSING;
  return clip(line, LETTER_LIMITS.closing);
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}
