import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { EditorialPlan } from "@/features/tailor/schemas";
import type { EditorialDoubt, LibraryExcerpt, RevisionTarget } from "@/features/tailor/revise";

/**
 * One revision of the entries that left strong evidence off the page.
 * It does not select a new resume. docs/05-AI.md → Revision pass.
 */

export const REVISE_SYSTEM = `You revise specific resume entries. The draft left verified evidence off the page.
Rewrite only the entries you are given. Return the full bullet list for each of those entries.

RULES
1. Use only the current lines and the unused sources. Do not add employers, titles, dates, tools,
   technologies, certifications, metrics, scope, or outcomes those sources do not state.
2. You may combine unused sources with a current line when they belong to the same entry.
   Cite every source the new line uses. Do not cite a source you do not use.
3. Do not raise proficiency. Familiarity, use, coursework, a project, and professional
   experience stay in the category the sources state.
4. Do not introduce a number the sources do not contain.
5. Prefer action, then the concrete implementation, then a purpose or result the sources state.
   Do not invent a result. Do not force that shape when it sounds unnatural.
6. If a current line is already specific, keep it. If a current line is vague or leaves out
   concrete tools, actions, or results that its own sources state, rewrite that line from those
   sources. Add or combine unused sources only to surface facts that are not already specific.
   Do not add facts.
7. what names the editorial change. why names the requirement and the verified facts you combined.
   Do not say "ATS", "impactful", "stronger keywords", "better aligned", or "more professional".
8. requirementIds are the ids you were given for that entry, or empty.`;

export const ReviseSchema = z.object({
  entries: z.array(
    z.object({
      ref: z.string(),
      bullets: z.array(
        z.object({
          sourceRefs: z.array(z.string()),
          text: z.string(),
          what: z.string(),
          why: z.string(),
          requirementIds: z.array(z.string()),
        }),
      ),
    }),
  ),
});

export function buildReviseContent(input: {
  title: string;
  company: string;
  targets: readonly RevisionTarget[];
}): Anthropic.ContentBlockParam[] {
  const blocks = input.targets
    .map((target) => {
      const current = target.current
        .map(
          (bullet) =>
            `  current [${bullet.sourceRefs.map(oneLine).join(", ")}]: ${oneLine(bullet.text)}`,
        )
        .join("\n");
      const unused = target.unused
        .map((source) => `  unused ${oneLine(source.ref)}: ${oneLine(source.text)}`)
        .join("\n");
      const requirements =
        target.requirementIds.length > 0 ? target.requirementIds.map(oneLine).join(", ") : "none";
      return [
        `<entry ref="${oneLine(target.entryRef)}" reason="${target.reason}">`,
        `Requirements: ${requirements}`,
        current || "  current: none",
        unused,
        "</entry>",
      ].join("\n");
    })
    .join("\n");
  const job = `Title: ${oneLine(input.title)} | Company: ${oneLine(input.company)}`;
  const text = ["<job>", neutralize(job, "job"), "</job>", "", "<entries>", neutralize(blocks, "entries"), "</entries>"].join(
    "\n",
  );
  return [{ type: "text", text }];
}

/**
 * One editorial pass over the whole draft. It may change selection, space,
 * order, summary, and wording. It runs only when the draft disagrees with
 * its strategy or strong evidence is still off the page.
 */
export const EDITORIAL_SYSTEM = `You are editing a finished resume against the strategy that produced it and the library excerpts.
The strategy can be wrong. If another combination of these excerpts is a stronger truthful resume for this job, change the selection.

You may change which entries appear, how many bullets each one has, their order, the summary, and the wording.
Return the complete resume you want to keep, not a patch. Set changed to false only when every check below is already satisfied. If any check fails, changed must be true and entries must be the full revised resume. Do not return an empty entries list.

CHECKS
- The resume states the positioning, using only library facts.
- Each lead has the emphasis the strategy gave it. A lead with fewer lines than the strategy, while an unused source adds a tool, a test, a review, or a result the page does not state, is not done.
- No stronger excerpt was left off so a weaker one could stay.
- No support entry takes more lines than its contribution.
- Implementation, testing, and deployment are written when the excerpts state them. A list of product features is not a substitute.
- A qualification is not left as a skill name when an excerpt shows the work.
- Two entries do not spend lines on the same qualification. A second deployed website stays only when it adds a qualification the page does not already show.
- The summary introduces the positioning and does not add a tool or result the excerpts do not state.
- The order puts the leads first within a section.
- The resume fits the page length.

RULES
1. Use only the library excerpts. Do not add employers, titles, dates, tools, technologies, certifications, metrics, scope, or outcomes those excerpts do not state.
2. Cite every source a line uses, under the heading entry for that role. A source from a different role is not allowed. At most five sources on a line.
3. Do not raise proficiency. Familiarity, use, coursework, a project, and professional experience stay in the category the sources state.
4. Do not introduce a number the sources do not contain.
5. Prefer the concrete implementation, testing, or deployment the sources state over a list of product features.
6. Give space to the evidence that most strengthens this application. A support entry may keep one line. A lead may keep more. Drop a line or an entry that repeats a qualification already established.
7. The summary is 2 or 3 sentences grounded in the excerpts. Do not open with a title the library does not use.
8. what names the editorial change. why names the requirement and the verified facts. Do not say "ATS", "impactful", "stronger keywords", "better aligned", or "more professional".
9. because is one sentence on what you changed, or why you kept the draft.`;

export const EditorialSchema = z.object({
  changed: z.boolean(),
  because: z.string(),
  findings: z.array(
    z.object({
      check: z.string(),
      ok: z.boolean(),
    }),
  ),
  summary: z.string(),
  entries: z.array(
    z.object({
      ref: z.string(),
      bullets: z.array(
        z.object({
          sourceRefs: z.array(z.string()),
          text: z.string(),
          what: z.string(),
          why: z.string(),
          requirementIds: z.array(z.string()),
        }),
      ),
    }),
  ),
});

export function buildEditorialContent(input: {
  title: string;
  company: string;
  length: 1 | 2;
  strategy: EditorialPlan;
  doubts: readonly EditorialDoubt[];
  draft: readonly { ref: string; bullets: readonly { sourceRefs: readonly string[]; text: string }[] }[];
  library: readonly LibraryExcerpt[];
  sameRole: string;
}): Anthropic.ContentBlockParam[] {
  const strategy = [
    `Hiring for: ${oneLine(input.strategy.hiringFor ?? "")}`,
    `Positioning: ${oneLine(input.strategy.positioning ?? "")}`,
    `Narrative: ${oneLine(input.strategy.narrative)}`,
    `Close call: ${input.strategy.closeCall === true ? "yes" : "no"}`,
    "Evidence:",
    ...(input.strategy.evidence ?? []).map(
      (row) =>
        `  ${oneLine(row.ref)} ${row.use} ${row.bullets} lines — ${oneLine(row.because)}`,
    ),
    `Gaps: ${(input.strategy.gaps ?? []).map(oneLine).join(", ") || "none"}`,
  ].join("\n");
  const doubts =
    input.doubts.length > 0
      ? input.doubts.map((doubt) => `  ${doubt.code} ${oneLine(doubt.ref)}`).join("\n")
      : "  The draft left verified evidence off the page, or hid facts its sources state.";
  const draft = input.draft
    .map((entry) => {
      const lines = entry.bullets
        .map((bullet) => `  [${bullet.sourceRefs.map(oneLine).join(", ")}] ${oneLine(bullet.text)}`)
        .join("\n");
      return `<entry ref="${oneLine(entry.ref)}">\n${lines || "  (no bullets)"}\n</entry>`;
    })
    .join("\n");
  const library = input.library
    .map((entry) => {
      const lines = entry.bullets
        .map((bullet) => `  ${oneLine(bullet.ref)}: ${oneLine(bullet.text)}`)
        .join("\n");
      const org = entry.organization ? ` @ ${oneLine(entry.organization)}` : "";
      return `<entry ref="${oneLine(entry.ref)}" kind="${oneLine(entry.kind)}" title="${oneLine(entry.title)}${org}">\n${lines || "  (no bullets)"}\n</entry>`;
    })
    .join("\n");
  const text = [
    `<job>`,
    neutralize(`Title: ${oneLine(input.title)} | Company: ${oneLine(input.company)} | Pages: ${input.length}`, "job"),
    `</job>`,
    "",
    `<strategy>`,
    neutralize(strategy, "strategy"),
    `</strategy>`,
    "",
    `<doubts>`,
    neutralize(doubts, "doubts"),
    `</doubts>`,
    "",
    `<same-role>`,
    neutralize(input.sameRole, "same-role"),
    `</same-role>`,
    "",
    `<draft>`,
    neutralize(draft, "draft"),
    `</draft>`,
    "",
    `<library>`,
    neutralize(library, "library"),
    `</library>`,
  ].join("\n");
  return [{ type: "text", text }];
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function neutralize(text: string, tag: string): string {
  return text.replace(new RegExp(`</\\s*${tag}\\s*>`, "gi"), `</ ${tag}>`);
}
