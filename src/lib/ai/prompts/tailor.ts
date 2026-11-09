import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { z } from "zod";

import type { JobAnalysis } from "@/features/jobs/schemas";
import { RequirementMatch, TailorSkillGroup } from "@/features/tailor/schemas";

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
2. Every output bullet must cite exactly one sourceRef, and it must belong to the entry it is
   listed under (E3.B1 can only appear under E3). Do not merge two bullets into one line.
3. Do not introduce any number that is not in the cited source. The summary may use a whole-year
   tenure taken from an entry's dates only when that figure is rounded down.
4. You may: rephrase for clarity, relevance, and order; drop words that do not help; lead with
   the fact most relevant to this posting; and use the posting's terminology ONLY when the cited
   source says the same thing ("Postgres" → "PostgreSQL" is fine; "SQL" → "PostgreSQL" is not;
   "Excel" may be written "Microsoft Excel"). Do not raise the role: helped, assisted, or
   supported does not become led, directed, or managed. Do not turn "used SQL" into a database
   the source does not name.
5. If the candidate lacks something the posting wants, leave it out. Do not imply it, and do
   not give them the job's title. A reporting analyst applying for a data engineer role stays
   a reporting analyst who can show transferable data work.
6. Do not describe academic, personal, or coursework use of a tool as production experience.

OBJECTIVE
Produce the strongest truthful resume for this posting. Prefer a directly supported accomplishment
over a keyword overlap. Transferable evidence is partial, not met. Leave unsupported requirements
out. Selecting relevant bullets is not enough. Rewrite a bullet when the wording can be clearer or
more relevant without adding facts. Leave a bullet unchanged when the original is already specific
and stronger. Do not change a line only to swap a synonym.

REWRITING
- Keep every tool, employer, metric, date, scope, and outcome inside the cited bullets.
- You may emphasize the relevant half of a bullet and use precise verbs the source supports
  ("merge" and "transform" may become "consolidated and transformed").
- You may not turn spreadsheet joins into ETL, pipelines, warehouses, or production engineering.
- Do not add "expert", "senior", "production", or years of experience the sources do not state.
- One idea per bullet. Do not repeat the same achievement under another entry.
- Cite one source only. Each saved bullet stays its own line.

APPROVED WORDING
The library may include saved variants for a bullet. For each bullet choose one:
- "variant": use that saved text when it is the best honest wording for this posting. Set variantId.
- "canonical": keep the library bullet. Set variantId to null.
- "rewrite": write a new line only when neither the library bullet nor a saved variant fits. Set variantId to null.
why is one sentence and names the requirement or emphasis. Do not invent a match percentage.
A variant chosen for one job does not change the library.

SELECTION
- Read the whole library, including projects that are not already on a resume. Prefer evidence
  that is relevant, recent, and specific. A recent production project outweighs an older academic
  project when both relate to the role. Omit weak or redundant material.
- Always include EDUCATION entries (bullets optional).
- One page: up to 5 bullets for the most relevant recent role, 2–3 for others, older or less
  relevant roles may have 0–1. Two pages: up to 6 / 4 / 2. Use the room for stronger evidence.
  Do not pad.
- Order bullets within an entry by relevance to the posting, then by how specific they are.
- Skills: relevant skill refs only, in the categories that fit (Languages, Data and Analytics,
  Frameworks and Tools, Cloud and Infrastructure, Practices). No empty group. No skill twice.

STYLE
- Bullets start with a strong verb, past tense (present tense for a current role), no first
  person, no filler, ideally under 30 words, plain text only (no emojis or special symbols).
- Summary: 2 or 3 sentences. Name the work the library actually supports, then the capabilities
  and outcomes that match this role. Do not open with the posting's title unless a library
  headline or job title uses it. No clichés ("results-driven", "passionate", "team player").
  Prefer omitting years. If you mention years, use whole years only (round down) and only for
  the entry those dates belong to. Do not say the candidate worked with a team, squad, or
  stakeholder unless a source bullet states that relationship. "Used by N squads" is not
  "worked with those squads."

MATCH REPORT
- Exactly one requirementMatches item per requirement id.
- "met": the cited evidence shows the requirement itself, not a nearby keyword. Five years of
  production ETL is not met by Excel joins.
- "partial": related or transferable evidence, including a tool used in a narrower setting.
- "missing": no sufficient evidence. "missing" is a useful answer.
- A keyword in the library is not enough for "met" when the requirement asks for depth, seniority,
  or a different kind of work.
- evidenceRefs: the refs that support the verdict ([] for missing). note: one short sentence
  that says why, without adding facts.`;

/** Loose model output. Limits are applied by the guard, not this schema. */
export const OutputSchema = z.object({
  summary: z.string(),
  entries: z.array(
    z.object({
      ref: z.string(),
      bullets: z.array(
        z.object({
          sourceRefs: z.array(z.string()),
          text: z.string(),
          variantId: z.string().nullable(),
          choice: z.enum(["variant", "canonical", "rewrite"]),
          why: z.string(),
        }),
      ),
    }),
  ),
  skills: z.array(TailorSkillGroup),
  requirementMatches: z.array(RequirementMatch),
});

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
  variantsText?: string;
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
    "",
    "<variants>",
    neutralize(input.variantsText?.trim() || "none", "variants"),
    "</variants>",
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
