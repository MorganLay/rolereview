/**
 * Drops a library rewrite that adds a number, tool, or role the saved
 * library does not support. The suggestion may use other saved text.
 */

import { hasUnsupportedNumber } from "@/lib/ai/numbers";
import { inflatedRole, sameWording, unsupportedClaim } from "@/features/tailor/grounding";
import { STRONG_VERBS } from "@/features/library/verbs";

export const REWRITE_WHY_MAX = 200;
export const REWRITE_QUESTION_MAX = 200;
export const REWRITE_TEXT_MAX = 400;

export type RewriteDecision =
  | { ok: true; text: string; why: string; question: string | null }
  | { ok: false; reason: "empty" | "unchanged" | "number" | "unsupported" };

export function reviewRewrite(input: {
  text: string;
  why: string;
  question: string | null;
  original: string;
  evidence: readonly string[];
}): RewriteDecision {
  const reviewed = reviewGrounded({ ...input, max: REWRITE_TEXT_MAX });
  if (!reviewed.ok) return reviewed;
  return { ...reviewed, question: cleanQuestion(input.question, input.evidence) };
}

/** Same grounding rules for a headline or summary, with that field's length cap. */
export function reviewGrounded(input: {
  text: string;
  why: string;
  original: string;
  evidence: readonly string[];
  max: number;
}): RewriteDecision {
  const text = clip(input.text.trim(), input.max);
  if (text.length === 0) return { ok: false, reason: "empty" };
  if (input.original.trim().length > 0 && sameWording(text, input.original)) {
    return { ok: false, reason: "unchanged" };
  }
  if (hasUnsupportedNumber(text, input.evidence)) return { ok: false, reason: "number" };
  if (unsupportedClaim(text, input.evidence) !== null) {
    return { ok: false, reason: "unsupported" };
  }
  if (inflatedRole(text, input.evidence) !== null) {
    return { ok: false, reason: "unsupported" };
  }

  const why = clip(input.why.trim(), REWRITE_WHY_MAX);
  if (why.length === 0) return { ok: false, reason: "empty" };
  return { ok: true, text, why, question: null };
}

/** A hypothesis must be a question and must not invent a number. */
export function reviewQuestions(
  questions: readonly string[],
  evidence: readonly string[],
  limit: number,
): string[] {
  const kept: string[] = [];
  for (const raw of questions) {
    const text = clip(raw.trim(), REWRITE_QUESTION_MAX);
    if (!text.includes("?")) continue;
    if (hasUnsupportedNumber(text, evidence)) continue;
    if (/^(you|they|the candidate)\b/i.test(text)) continue;
    kept.push(text);
    if (kept.length >= limit) break;
  }
  return kept;
}

/**
 * A reusable summary may name work the person has done.
 * A classification code such as CS-01 stays off it unless that code is a title they held.
 */
const RANK = ["senior", "director", "chief", "supervisor", "principal"] as const;

/**
 * A headline is the short line under the name. It names a focus.
 * It is not a bullet ("Built and deployed a production web app") and not a
 * tool list ("Analyst | SQL, Python, Cognos"). It does not repeat one past job title.
 */
export function headlineShapeAllowed(text: string, entryTitles: readonly string[]): boolean {
  const line = text.trim();
  if (line.length < 3 || line.length > 80) return false;
  if (/[|•\n.;!?]/.test(line)) return false;
  const words = line.split(/\s+/).filter((word) => word.length > 0);
  if (words.length > 8) return false;
  const first = (words[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (STRONG_VERBS.has(first)) return false;
  const key = line.toLowerCase();
  return !entryTitles.some((title) => title.trim().toLowerCase() === key);
}

/** A headline may describe a focus. It may not award a rank the library never uses. */
export function headlineRankAllowed(text: string, evidence: readonly string[]): boolean {
  const blob = evidence.join("\n");
  for (const word of RANK) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    if (pattern.test(text) && !pattern.test(blob)) return false;
  }
  return true;
}

export function reusableSummaryAllowed(
  text: string,
  entryTitles: readonly string[],
): boolean {
  const titles = entryTitles.join("\n");
  const codes = text.match(/\b(?:[A-Z]{2,}-\d{2}|CS-?\d{2})\b/g) ?? [];
  return codes.every((code) => titles.includes(code));
}

function cleanQuestion(question: string | null, evidence: readonly string[]): string | null {
  const text = clip(question?.trim() ?? "", REWRITE_QUESTION_MAX);
  if (text.length === 0 || !text.includes("?")) return null;
  if (hasUnsupportedNumber(text, evidence)) return null;
  return text;
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
