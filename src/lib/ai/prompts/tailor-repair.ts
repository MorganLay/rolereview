import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { JobAnalysis } from "@/features/jobs/schemas";
import { repairProblem, type RepairTarget } from "@/features/tailor/repair";

/**
 * One short call for rewrites the guard reverted.
 * It does not select a new resume. docs/05-AI.md → Repair pass.
 */

export const REPAIR_SYSTEM = `You repair resume bullets that failed a factual check. You are given the source
wording, the rejected wording, and why it was rejected. Write a replacement that stays inside
the source.

RULES
1. Use only facts in that source. Do not add employers, titles, dates, tools, technologies,
   certifications, metrics, scope, or outcomes the source does not state.
2. Do not introduce a number the source does not contain.
3. Do not raise the role. Helped, assisted, or supported does not become led, directed, or managed.
4. Do not turn a related tool into one the source does not name. Spreadsheet joins are not ETL,
   pipelines, or production engineering.
5. If a truthful rewrite cannot say more than the source, return the source text unchanged.
6. The text you return is the line on the resume. Do not describe a suggestion.
7. what is one clause naming the editorial change, or empty when the text is unchanged.
   why names the requirement that motivated a real change, or is empty when unchanged.
   Do not say "ATS", "impactful", "stronger keywords", or "better aligned".`;

export const RepairSchema = z.object({
  bullets: z.array(
    z.object({
      sourceRef: z.string(),
      text: z.string(),
      what: z.string(),
      why: z.string(),
    }),
  ),
});

export function buildRepairContent(input: {
  title: string;
  company: string;
  requirements: JobAnalysis["requirements"];
  targets: readonly RepairTarget[];
}): Anthropic.ContentBlockParam[] {
  const requirements = input.requirements
    .slice(0, 12)
    .map(
      (requirement) =>
        `  ${oneLine(requirement.id)} [${requirement.importance}] ${oneLine(requirement.text)}`,
    )
    .join("\n");
  const job = [
    `Title: ${oneLine(input.title)} | Company: ${oneLine(input.company)}`,
    "Requirements:",
    requirements,
  ].join("\n");
  const bullets = input.targets
    .map((target) =>
      [
        `<source ref="${oneLine(target.sourceRef)}">`,
        `<problem>${oneLine(repairProblem(target.code))}</problem>`,
        `<source_text>${oneLine(clip(target.sourceText))}</source_text>`,
        `<rejected>${oneLine(clip(target.rejected))}</rejected>`,
        "</source>",
      ].join("\n"),
    )
    .join("\n");
  const text = [
    "<job>",
    neutralize(job, "job"),
    "</job>",
    "",
    "<bullets>",
    neutralize(bullets, "bullets"),
    "</bullets>",
  ].join("\n");
  return [{ type: "text", text }];
}

function clip(value: string): string {
  return value.length > 400 ? value.slice(0, 400) : value;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function neutralize(text: string, tag: string): string {
  return text.replace(new RegExp(`</\\s*${tag}\\s*>`, "gi"), `</ ${tag}>`);
}
