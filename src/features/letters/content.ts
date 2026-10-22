/**
 * Editable cover letter for the workspace.
 * docs/02-USER-FLOWS.md → Cover letter workspace.
 * docs/04-DATA-MODEL.md → CoverLetterContent.
 */

import type { Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeTemplateAccess } from "@/features/tailor/content";
import type { ResumeTemplateId } from "@/lib/pdf/template";

import {
  LETTER_LIMITS,
  type CoverLetterContent,
  type LetterLength,
  type LetterParagraph,
  type LetterTone,
  type ValidatedLetterOutput,
} from "./schemas";

export type LetterEditIssue =
  | "greeting"
  | "closing"
  | "signature"
  | "paragraphs"
  | "paragraphText";

export type LetterEditResult =
  | { ok: true; content: CoverLetterContent }
  | { ok: false; issue: LetterEditIssue };

export type LetterWorkspaceData = {
  jobId: string;
  jobTitle: string;
  company: string;
  letterId: string;
  version: number;
  savedAt: string;
  timeZone: string;
  content: CoverLetterContent;
  snapshot: LibrarySnapshot;
  tone: LetterTone;
  length: LetterLength;
  requirements: Requirement[];
  templateId: ResumeTemplateId;
  submitted: boolean;
  rating: 1 | -1 | null;
  templates: ResumeTemplateAccess;
};

/** "10:42" in the user's timezone. */
export function formatSavedTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = formatClock(date, timeZone) ?? formatClock(date, "UTC");
  return formatted ?? "";
}

/**
 * Canonical letter after an edit.
 * Paragraph ids, order, source refs, and requirement ids stay as stored.
 */
export function applyLetterEdit(input: {
  stored: CoverLetterContent;
  incoming: CoverLetterContent;
  aiOutput: ValidatedLetterOutput | null;
}): LetterEditResult {
  const greeting = oneLine(input.incoming.greeting, LETTER_LIMITS.greeting);
  if (greeting.length === 0) return { ok: false, issue: "greeting" };

  const closing = oneLine(input.incoming.closing, LETTER_LIMITS.closing);
  if (closing.length === 0) return { ok: false, issue: "closing" };

  const signature = oneLine(input.incoming.signature, LETTER_LIMITS.signature);
  const incomingById = indexParagraphs(input.incoming.paragraphs);
  if (!incomingById) return { ok: false, issue: "paragraphs" };
  if (incomingById.size !== input.stored.paragraphs.length) {
    return { ok: false, issue: "paragraphs" };
  }

  const paragraphs: LetterParagraph[] = [];
  for (const [index, stored] of input.stored.paragraphs.entries()) {
    const incoming = incomingById.get(stored.id);
    if (!incoming) return { ok: false, issue: "paragraphs" };

    const text = oneLine(incoming.text, LETTER_LIMITS.paragraph);
    if (text.length === 0) return { ok: false, issue: "paragraphText" };

    const ai = input.aiOutput?.paragraphs[index];
    const baseline = ai ? oneLine(ai.text, LETTER_LIMITS.paragraph) : stored.text;
    const reverted = ai
      ? ai.reverted && text === baseline
      : stored.reverted && text === stored.text;
    const edited = ai ? text !== baseline : text === stored.text ? stored.edited : true;

    paragraphs.push({
      id: stored.id,
      text,
      included: incoming.included,
      sourceRefs: [...stored.sourceRefs],
      reverted,
      edited,
      needsWhy: stored.needsWhy,
    });
  }

  return {
    ok: true,
    content: {
      schemaVersion: 1,
      greeting,
      paragraphs,
      closing,
      signature,
      requirementIdsAddressed: [...input.stored.requirementIdsAddressed],
    },
  };
}

function indexParagraphs(
  paragraphs: readonly LetterParagraph[],
): Map<string, LetterParagraph> | null {
  const byId = new Map<string, LetterParagraph>();
  for (const paragraph of paragraphs) {
    if (byId.has(paragraph.id)) return null;
    byId.set(paragraph.id, paragraph);
  }
  return byId;
}

function oneLine(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function formatClock(date: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    if (!hour || !minute) return null;
    return `${hour}:${minute}`;
  } catch {
    return null;
  }
}
