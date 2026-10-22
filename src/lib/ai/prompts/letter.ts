import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import type { JobAnalysis } from "@/features/jobs/schemas";
import {
  LetterOutput,
  type LetterLength,
  type LetterTone,
} from "@/features/letters/schemas";
import { POSTING_MAX } from "@/lib/ai/prompts/tailor";

/**
 * COVER_LETTER prompt and loose output schema. docs/05-AI.md → COVER_LETTER.
 * The guard enforces limits after the call.
 */

const LENGTH_LINE: Record<LetterLength, string> = {
  short: "Length: short (~180 words).",
  standard: "Length: standard (~300 words).",
};

export const SYSTEM = `You write cover letters grounded strictly in the candidate's library.

TRUTHFULNESS (overrides everything):
- Claims about the candidate must come from the cited library refs. Never add employers,
  titles, tools, metrics, or outcomes that are not in those items. No new numbers.
- Claims about the company or role must come from the posting ("POSTING") or the candidate's own
  reasons ("WHY"). Never invent company facts, values, products, news or culture.
- If no reasons are provided, explain interest through the role's responsibilities in the posting.

STRUCTURE: 3–5 paragraphs: (1) the role and a one-line hook connecting the candidate's strongest
relevant experience to the role; (2–3) two or three requirements from the posting matched to
concrete library evidence; (4) why this role/company (from WHY or POSTING); (5) short close
with a call to talk. Every paragraph lists its sourceRefs.

STYLE: match the tone option; first person; plain and specific; no clichés ("I am writing to
express my interest", "passionate", "synergy", "team player"); no flattery; within the target length.`;

/** Loose model output. Limits are applied by the guard, not this schema. */
export const OutputSchema = LetterOutput;

export type LetterPromptInput = {
  libraryText: string;
  title: string;
  company: string;
  requirements: JobAnalysis["requirements"];
  keywords: string[];
  posting: string;
  whyCompany: string | null;
  tone: LetterTone;
  length: LetterLength;
  recipientName: string | null;
  candidateName: string | null;
  /** Included bullet refs from a tailored resume. Null when no resume is selected. */
  resumeFocus: string[] | null;
};

export function buildContent(
  input: LetterPromptInput,
): Anthropic.ContentBlockParam[] {
  const posting = input.posting.slice(0, POSTING_MAX);
  const requirements = input.requirements
    .map(
      (requirement) =>
        `  ${oneLine(requirement.id)} [${requirement.importance}][${requirement.kind}] ${oneLine(requirement.text)}`,
    )
    .join("\n");
  const job = [
    `Title: ${oneLine(input.title)} | Company: ${oneLine(input.company)}`,
    "Requirements:",
    requirements,
    `Keywords: ${input.keywords.map(oneLine).join(", ")}`,
  ].join("\n");
  const focus =
    input.resumeFocus && input.resumeFocus.length > 0
      ? input.resumeFocus.map(oneLine).join(", ")
      : "none";
  const why =
    input.whyCompany && input.whyCompany.trim().length > 0
      ? oneLine(input.whyCompany)
      : "none provided";
  const recipient =
    input.recipientName && input.recipientName.trim().length > 0
      ? oneLine(input.recipientName)
      : "Hiring Manager";
  const candidate =
    input.candidateName && input.candidateName.trim().length > 0
      ? oneLine(input.candidateName)
      : "none";
  const options = [
    `Tone: ${input.tone}.`,
    LENGTH_LINE[input.length],
    `Recipient: ${recipient}.`,
    `Candidate name: ${candidate}.`,
  ].join("\n");

  const text = [
    "<library>",
    neutralize(input.libraryText, "library"),
    "</library>",
    "",
    "<job>",
    neutralize(job, "job"),
    "</job>",
    "",
    "<posting>",
    neutralize(posting, "posting"),
    "</posting>",
    "",
    "<resume_focus>",
    neutralize(focus, "resume_focus"),
    "</resume_focus>",
    "",
    "<why_company>",
    neutralize(why, "why_company"),
    "</why_company>",
    "",
    "<options>",
    neutralize(options, "options"),
    "</options>",
  ].join("\n");

  return [{ type: "text", text }];
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Keep user text inside the wrapper if it contains the closing tag. */
function neutralize(text: string, tag: string): string {
  return text.replace(new RegExp(`</\\s*${tag}\\s*>`, "gi"), `</ ${tag}>`);
}
