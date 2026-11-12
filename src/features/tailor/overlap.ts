/**
 * Two bullets on one role can describe the same claim. The more specific
 * supported line is preferred. A number alone does not win, and a line that
 * is the only evidence for a requirement is kept. Library text is not deleted.
 */

import { KNOWN_TERMS } from "@/features/library/strength";

import { normalizeMatchText, termAppears } from "./keywords";

const TOOL_TOKENS = new Set<string>(
  KNOWN_TERMS.filter((term) => !term.includes(" ") && term.length >= 3),
);

const STOP = new Set([
  "about",
  "across",
  "after",
  "again",
  "also",
  "and",
  "another",
  "around",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "business",
  "customer",
  "customers",
  "during",
  "each",
  "experience",
  "from",
  "have",
  "having",
  "helped",
  "information",
  "into",
  "including",
  "kept",
  "made",
  "make",
  "other",
  "over",
  "people",
  "process",
  "project",
  "projects",
  "responsible",
  "service",
  "services",
  "some",
  "staff",
  "support",
  "system",
  "systems",
  "team",
  "teams",
  "that",
  "their",
  "them",
  "then",
  "they",
  "this",
  "through",
  "under",
  "updated",
  "updates",
  "using",
  "with",
  "within",
  "without",
  "work",
  "worked",
  "working",
]);

/** One shared word of this kind is not enough to call two lines the same claim. */
const GENERIC_TOPIC = new Set([
  "client",
  "clients",
  "data",
  "experience",
  "information",
  "process",
  "project",
  "record",
  "records",
  "report",
  "reports",
  "resume",
  "service",
  "support",
  "system",
  "team",
  "update",
  "work",
]);

/** Tools plus concrete scope. A count is not part of this score. */
export function evidenceSubstance(text: string): number {
  return Math.min(toolCount(text), 3) + scopeScore(text);
}

/**
 * True when `stronger` is the same claim as `weaker`, at least as relevant
 * to `terms`, and more specific for a reason other than a number.
 */
export function dominates(
  stronger: string,
  weaker: string,
  terms: readonly string[],
): boolean {
  if (!sameClaim(stronger, weaker)) return false;
  if (evidenceSubstance(stronger) - evidenceSubstance(weaker) < 1) return false;
  return termOverlap(stronger, terms) >= termOverlap(weaker, terms);
}

/** The weaker line names a requirement term the stronger line does not. */
export function coversExtraMust(
  weaker: string,
  stronger: string,
  musts: readonly string[],
): boolean {
  const weakHay = normalizeMatchText(weaker);
  const strongHay = normalizeMatchText(stronger);
  return musts.some((term) => {
    const needle = normalizeMatchText(term);
    if (needle.length < 3) return false;
    return mentionsTerm(weakHay, needle) && !mentionsTerm(strongHay, needle);
  });
}

function sameClaim(left: string, right: string): boolean {
  const leftWords = roots(left);
  const rightWords = roots(right);
  let shared = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) shared += 1;
  }
  if (shared >= 2) return true;
  if (shared !== 1) return false;
  const only = [...leftWords].find((word) => rightWords.has(word));
  if (!only || GENERIC_TOPIC.has(only)) return false;
  const fewer = Math.min(leftWords.size, rightWords.size);
  return fewer <= 4;
}

function roots(text: string): Set<string> {
  const words = topicWords(text);
  const kept = new Set<string>();
  for (const word of words) {
    if (word.endsWith("s") && words.has(word.slice(0, -1))) continue;
    kept.add(word);
  }
  return kept;
}

function topicWords(text: string): Set<string> {
  const words = normalizeMatchText(text).split(/[^a-z0-9+#.]+/);
  const tokens = new Set<string>();
  for (const word of words) {
    if (word.length < 5 || STOP.has(word) || TOOL_TOKENS.has(word)) continue;
    tokens.add(word);
    if (word.endsWith("s") && word.length > 5 && !STOP.has(word.slice(0, -1))) {
      tokens.add(word.slice(0, -1));
    }
    if (word.endsWith("ing") && word.length > 8) {
      const stem = word.slice(0, -3);
      if (stem.length >= 6 && !STOP.has(stem)) tokens.add(stem);
    }
  }
  return tokens;
}

function toolCount(text: string): number {
  const haystack = normalizeMatchText(text);
  let count = 0;
  const seen = new Set<string>();
  const terms = [...KNOWN_TERMS].sort((left, right) => right.length - left.length);
  for (const term of terms) {
    if (term.length < 3 || seen.has(term)) continue;
    if (!termAppears(haystack, term)) continue;
    if ([...seen].some((kept) => kept.includes(term))) continue;
    seen.add(term);
    count += 1;
  }
  return count;
}

function scopeScore(text: string): number {
  const count = roots(text).size;
  if (count >= 6) return 2;
  if (count >= 3) return 1;
  return 0;
}

function mentionsTerm(haystack: string, needle: string): boolean {
  if (termAppears(haystack, needle)) return true;
  if (needle.endsWith("s") && needle.length > 4 && termAppears(haystack, needle.slice(0, -1))) {
    return true;
  }
  if (!needle.endsWith("s") && needle.length > 3 && termAppears(haystack, `${needle}s`)) return true;
  return false;
}

function termOverlap(text: string, terms: readonly string[]): number {
  const haystack = normalizeMatchText(text);
  let count = 0;
  const seen = new Set<string>();
  for (const term of terms) {
    const needle = normalizeMatchText(term);
    if (needle.length < 2 || seen.has(needle)) continue;
    if (!mentionsTerm(haystack, needle)) continue;
    seen.add(needle);
    count += 1;
  }
  return count;
}
