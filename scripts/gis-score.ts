/**
 * Scores a GIS beta run after the model has answered.
 * This file is not a prompt and is not imported by the tailor or import calls.
 */

import { normalizeMatchText, termAppears } from "@/features/tailor/keywords";

export type ScoreCheck = {
  id: string;
  pass: boolean;
  severity: "blocker" | "high" | "medium" | "low";
  detail: string;
};

/** Drop the answer key. The posting body above it is what the product analyzes. */
export function postingForModel(raw: string): string {
  return (raw.split(/\nTEST EXPECTATIONS\b/)[0] ?? raw).trim();
}

export function hasStandaloneCount(text: string, count: string): boolean {
  const wanted = count.replace(/,/g, "");
  if (!/^\d+$/.test(wanted)) return false;
  const haystack = text.replace(/,/g, "");
  return new RegExp(`(?<![0-9])${wanted}(?![0-9])`).test(haystack);
}

export function forbiddenClaims(text: string, terms: readonly string[]): string[] {
  const haystack = normalizeMatchText(text);
  return terms.filter((term) => termAppears(haystack, normalizeMatchText(term)));
}

export function checkNoCounts(text: string, counts: readonly string[]): ScoreCheck {
  const found = counts.filter((count) => hasStandaloneCount(text, count));
  return {
    id: "no-sparse-metrics",
    pass: found.length === 0,
    severity: "blocker",
    detail: found.length === 0 ? "No enriched counts in this text." : `Found ${found.join(", ")}.`,
  };
}

export function checkForbidden(text: string, terms: readonly string[]): ScoreCheck {
  const found = forbiddenClaims(text, terms);
  return {
    id: "no-unsupported-tools",
    pass: found.length === 0,
    severity: "blocker",
    detail:
      found.length === 0
        ? "Resume text does not name the unsupported tools."
        : `Resume text names ${found.join(", ")}.`,
  };
}
