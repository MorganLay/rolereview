import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { RevisionTarget } from "@/features/tailor/revise";

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

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function neutralize(text: string, tag: string): string {
  return text.replace(new RegExp(`</\\s*${tag}\\s*>`, "gi"), `</ ${tag}>`);
}
