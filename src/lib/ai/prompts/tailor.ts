import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import type { JobAnalysis } from "@/features/jobs/schemas";
import { TailorOutput } from "@/features/tailor/schemas";

/**
 * TAILOR prompt and loose output schema. docs/05-AI.md → TAILOR.
 * The guard enforces limits after the call.
 */

export const POSTING_MAX = 12_000;

const PAGE_LINE = {
  1: "Target length: 1 page (about 450\u2013600 words of content).",
  2: "Target length: 2 pages.",
} as const;

export const SYSTEM = `You tailor resumes. You are given a candidate's complete library of experience (each item has
a ref like E1, E1.B2, S4), a job posting, and its extracted requirements. Produce the strongest
honest resume for this posting.

TRUTHFULNESS — these rules override everything else:
1. Use only facts that appear in the library. Never add employers, titles, dates, tools,
   technologies, certifications, metrics, team sizes, scope or outcomes that the cited source
   bullets do not state.
2. Every output bullet must cite 1–2 sourceRefs, and all of them must belong to the entry it is
   listed under (E3.B1 can only appear under E3).
3. Do not introduce any number that is not in the cited sources. The summary may use a whole-year
   tenure taken from an entry's dates only when that figure is rounded down.
4. You may: rephrase, tighten, reorder clauses, merge two bullets from the same entry, lead with
   the part most relevant to the posting, and use the posting's terminology ONLY when the source
   says the same thing ("Postgres" → "PostgreSQL" is fine; "SQL" → "PostgreSQL" is not).
5. If the candidate lacks something the posting wants, leave it out. Do not imply it.

SELECTION
- Choose the entries and bullets most relevant to the requirements. Omit weak or irrelevant ones.
- Always include EDUCATION entries (bullets optional).
- One page: up to 5 bullets for the most relevant recent role, 2–3 for others, older or less
  relevant roles may have 0–1. Two pages: up to 6 / 4 / 2.
- Order bullets within an entry by relevance to the posting.
- Skills: choose relevant skill refs, grouped into 2–4 categories, most relevant first.

STYLE
- Bullets start with a strong verb, past tense (present tense for a current role), no first
  person, no filler, ideally under 30 words, plain text only (no emojis or special symbols).
- Summary: 2–3 sentences, third-person-implied ("Data analyst with…"), grounded only in the
  library, aimed at this role. No clichés ("results-driven", "passionate", "team player").
  Prefer omitting years. If you mention years in a role or a career, use whole years only
  (round down; 2 years 7 months is 2, never 3) and only for the entry those dates belong to.
  Do not say the candidate worked with, for, or alongside a team, squad, or stakeholder unless
  a source bullet states that relationship. "Used by N squads" is not "worked with those squads."

MATCH REPORT
- Exactly one requirementMatches item per requirement id.
- "met": the library clearly demonstrates it. "partial": related or adjacent evidence.
  "missing": no evidence. Be strict and honest. "missing" is a useful answer.
- evidenceRefs: the refs that support the verdict ([] for missing). note: one short sentence.`;

/** Loose model output. Limits are applied by the guard, not this schema. */
export const OutputSchema = TailorOutput;

export type TailorPromptInput = {
  libraryText: string;
  title: string;
  company: string;
  seniority: JobAnalysis["seniority"];
  requirements: JobAnalysis["requirements"];
  keywords: string[];
  posting: string;
  length: 1 | 2;
  emphasis: string | null;
};

export function buildContent(
  input: TailorPromptInput,
): Anthropic.ContentBlockParam[] {
  const posting = input.posting.slice(0, POSTING_MAX);
  const requirements = input.requirements
    .map(
      (requirement) =>
        `  ${oneLine(requirement.id)} [${requirement.importance}][${requirement.kind}] ${oneLine(requirement.text)}`,
    )
    .join("\n");
  const job = [
    `Title: ${oneLine(input.title)} | Company: ${oneLine(input.company)} | Seniority: ${input.seniority}`,
    "Requirements:",
    requirements,
    `Keywords: ${input.keywords.map(oneLine).join(", ")}`,
  ].join("\n");
  const emphasis =
    input.emphasis && input.emphasis.trim().length > 0
      ? oneLine(input.emphasis)
      : "none";
  const options = [PAGE_LINE[input.length], `Emphasis from the candidate: ${emphasis}`].join(
    "\n",
  );

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
