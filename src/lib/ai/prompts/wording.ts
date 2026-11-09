import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Headlines and summaries from saved experience.
 * A headline may name a focus. It must not invent a job title.
 * A reusable summary stays neutral. A posting-specific summary is for one job.
 */

export const SYSTEM = `You suggest wording from a person's saved experience. Use only employers, titles, tools, and
outcomes that appear there. Do not invent seniority.

When the task is a headline, write the short line that sits under the person's name.
It names one professional focus. It is not a resume bullet and not a keyword list.
- One line, at most 8 words. No vertical bars, bullets, or periods.
- Do not start with an action verb. "Built and deployed a production web app" belongs on a
  project bullet. "Full-stack developer" can be the headline, when that work is saved.
- Do not stack tools. "Reporting analyst" is a headline. "Analyst | SQL, Python, Cognos" is not.
- Do not repeat one past job title, and do not award a title they did not hold.
  "Shift supervisor" is not a headline unless a saved title says so.
- Offer four options. They differ in emphasis, not in facts. why is one sentence.

When the task is a summary, write a reusable professional summary.
It must not name a competition, a classification such as CS-01, or an employer they are applying to.
That kind of summary belongs on one job, not as the default.
Offer four options. They differ in emphasis, not in facts. why is one sentence.`;

export const OutputSchema = z.object({
  options: z.array(z.object({ text: z.string(), why: z.string() })),
});

export function buildContent(input: {
  kind: "headline" | "summary";
  context: string;
  jobTitle: string | null;
  company: string | null;
}): Anthropic.ContentBlockParam[] {
  const job =
    input.jobTitle && input.company
      ? `This wording is for one job: ${oneLine(input.jobTitle)} at ${oneLine(input.company)}. It will not become the default.`
      : "This wording is reusable. Keep it neutral.";
  const text = [
    `<task>${input.kind}</task>`,
    "",
    "<library>",
    neutralize(input.context, "library"),
    "</library>",
    "",
    "<scope>",
    neutralize(job, "scope"),
    "</scope>",
  ].join("\n");
  return [{ type: "text", text }];
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function neutralize(text: string, tag: string): string {
  return text.replace(new RegExp(`</\\s*${tag}\\s*>`, "gi"), `</ ${tag}>`);
}
