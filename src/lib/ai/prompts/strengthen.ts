import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Questions that might uncover real experience. They are hypotheses.
 * Nothing here is saved until the person confirms it.
 */

export const DISCOVER_SYSTEM = `You help someone remember work they already did. You are given a role and the lines they saved.
Ask questions that a person in that role might say yes to. These are hypotheses, not facts.
Do not say they did the work. Do not invent numbers, tools, or titles.

Ask four to six short questions. Each one ends with a question mark.
Ask about the tool or method, the scope, the deliverable, a measurable outcome, and the technical detail, but only where the saved lines do not already say it. Do not answer the question yourself.
Skip anything their saved lines already answer.
A crew member who wrote "made fries and cooked food" might be asked whether they worked a busy
meal period, trained a new hire, opened or closed, ran a food-safety check, or supervised a shift.
Ask only what fits the role and the lines you were given.`;

export const DiscoverSchema = z.object({
  questions: z.array(z.string()),
});

export const DRAFT_SYSTEM = `You draft one resume bullet from answers the person confirmed. Confirmed answers are facts.
A line that begins with "Confirmed:" is something they said yes to. If it includes "Detail:", that detail is authoritative.
Use the confirmed facts. Do not ignore them in favour of unrelated saved library lines.
Anything they did not confirm is not a fact. Do not add a tool, employer, number, or duty they did not confirm
and that is not already in the saved library.

If one or two short follow-up questions are needed before a bullet would be honest, return those
questions and set text to null. Otherwise set followUps to an empty list and write one bullet.
The bullet uses confirmed answers first, then saved library text only to fill in names and context
already stored. why is one sentence.`;

export const DraftSchema = z.object({
  followUps: z.array(z.string()),
  text: z.string().nullable(),
  why: z.string().nullable(),
});

export function buildDiscover(input: {
  title: string;
  organization: string | null;
  bullets: readonly string[];
  context: string;
}): Anthropic.ContentBlockParam[] {
  const role = [
    `Title: ${oneLine(input.title)}`,
    `Organization: ${oneLine(input.organization ?? "")}`,
    "Saved lines:",
    ...input.bullets.map((bullet) => `- ${oneLine(bullet)}`),
  ].join("\n");
  const text = [
    "<role>",
    neutralize(role, "role"),
    "</role>",
    "",
    "<library>",
    neutralize(input.context, "library"),
    "</library>",
  ].join("\n");
  return [{ type: "text", text }];
}

export function buildDraft(input: {
  title: string;
  confirmed: readonly string[];
  context: string;
  followUpRound: boolean;
}): Anthropic.ContentBlockParam[] {
  const answers = input.confirmed.map((line) => `- ${oneLine(line)}`).join("\n");
  const round = input.followUpRound
    ? "This is the follow-up round. Do not ask more questions. Write the bullet."
    : "You may ask at most two follow-up questions, or write the bullet.";
  const text = [
    "<confirmed>",
    neutralize(answers, "confirmed"),
    "</confirmed>",
    "",
    "<library>",
    neutralize(input.context, "library"),
    "</library>",
    "",
    "<round>",
    round,
    `Role: ${oneLine(input.title)}`,
    "</round>",
  ].join("\n");
  return [{ type: "text", text }];
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function neutralize(text: string, tag: string): string {
  return text.replace(new RegExp(`</\\s*${tag}\\s*>`, "gi"), `</ ${tag}>`);
}
