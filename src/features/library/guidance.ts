/**
 * A question for a thin bullet. It names only what the line already says,
 * and it asks for a tool, a deliverable, a result, or a technical detail.
 * It never supplies the answer.
 */

import { strings } from "@/copy/strings";

import { KNOWN_TERMS } from "./strength";

const STOP = new Set([
  "about",
  "after",
  "also",
  "and",
  "from",
  "have",
  "helped",
  "into",
  "made",
  "make",
  "responsible",
  "some",
  "that",
  "their",
  "them",
  "they",
  "this",
  "with",
  "worked",
  "working",
]);

export function guidanceQuestion(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  const hasTool = namesKnownTerm(trimmed);
  const hasFigure = /\d/.test(trimmed);
  const short = trimmed.split(/\s+/).length < 14;
  const asks: string[] = [];
  if (!hasTool) asks.push(strings.strength.questions.tool);
  if (short || !hasTool) asks.push(strings.strength.questions.deliverable);
  if (!hasFigure) asks.push(strings.strength.questions.outcome);
  if (asks.length === 0) return null;
  const subject = topicLabel(trimmed);
  return strings.strength.questions.lead(subject, joinAsks(asks));
}

function namesKnownTerm(text: string): boolean {
  const haystack = text.toLowerCase();
  return KNOWN_TERMS.some((term) => {
    const needle = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${needle}(?=$|[^a-z0-9])`, "i").test(haystack);
  });
}

function topicLabel(text: string): string {
  const words = text
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 5 && !STOP.has(word.toLowerCase()) && !/\d/.test(word));
  const unique: string[] = [];
  for (const word of words) {
    const key = word.toLowerCase();
    if (unique.some((item) => item.toLowerCase() === key)) continue;
    unique.push(word);
    if (unique.length === 2) break;
  }
  if (unique.length === 0) return strings.strength.questions.thisLine;
  return unique.join(" and ");
}

function joinAsks(asks: readonly string[]): string {
  if (asks.length === 1) return asks[0] ?? "";
  if (asks.length === 2) return `${asks[0]} and ${asks[1]}`;
  return `${asks.slice(0, -1).join(", ")}, and ${asks[asks.length - 1]}`;
}
