import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * One grounded rewrite of a library bullet. Phase 17 still owns three
 * suggestions and the placeholder that blocks save.
 */

export const SYSTEM = `You rewrite one resume bullet. You are given the bullet and other text this person has already saved.
Use only facts that appear in that saved text. You may bring in a tool, employer, or outcome from
elsewhere in the saved library when it clearly belongs to this same work. You may not invent an
employer, title, date, tool, responsibility, number, or outcome.

Write one alternative that is clearer or more specific. Do not swap a synonym and call it done.
Do not raise the role: helped, assisted, or supported does not become led, directed, or managed.
Do not name a database, language, or system the saved text does not name.

If a number would make the line stronger and the saved text has no such number, ask one question
and put no new digit in the rewrite.

why is one sentence about the wording, not a new fact.
question is null when you do not need a number. When you do, it is one question and it states no number.`;

export const OutputSchema = z.object({
  text: z.string(),
  why: z.string(),
  question: z.string().nullable(),
});

export function buildContent(input: {
  bullet: string;
  context: string;
}): Anthropic.ContentBlockParam[] {
  const text = [
    "<bullet>",
    neutralize(input.bullet, "bullet"),
    "</bullet>",
    "",
    "<library>",
    neutralize(input.context, "library"),
    "</library>",
  ].join("\n");
  return [{ type: "text", text }];
}

function neutralize(text: string, tag: string): string {
  return text.replace(new RegExp(`</\\s*${tag}\\s*>`, "gi"), `</ ${tag}>`);
}
