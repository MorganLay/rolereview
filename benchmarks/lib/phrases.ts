/**
 * Phrase checks for benchmark reports. A match still requires the same
 * numbers and the same credential. Separator words and punctuation may differ.
 */

const JOINERS = new Set(["to", "and", "or", "from", "of", "for", "the", "a", "an"]);

const MONTHS: Record<string, string> = {
  jan: "january",
  january: "january",
  feb: "february",
  february: "february",
  mar: "march",
  march: "march",
  apr: "april",
  april: "april",
  may: "may",
  jun: "june",
  june: "june",
  jul: "july",
  july: "july",
  aug: "august",
  august: "august",
  sep: "september",
  sept: "september",
  september: "september",
  oct: "october",
  october: "october",
  nov: "november",
  november: "november",
  dec: "december",
  december: "december",
};

export type PhraseMatch = "exact" | "equivalent" | "absent";

export function phraseMatch(haystack: string, phrase: string): PhraseMatch {
  if (phrase.trim().length === 0) return "absent";
  if (haystack.toLowerCase().includes(phrase.toLowerCase())) return "exact";
  return phraseEquivalent(haystack, phrase) ? "equivalent" : "absent";
}

export function phraseEquivalent(haystack: string, phrase: string): boolean {
  const needle = contentTokens(phrase);
  const hay = contentTokens(haystack);
  if (needle.length === 0 || hay.length < needle.length) return false;
  for (let start = 0; start <= hay.length - needle.length; start += 1) {
    if (needle.every((token, index) => hay[start + index] === token)) return true;
  }
  return false;
}

export function contentTokens(value: string): string[] {
  return expand(value)
    .split(/[^a-z0-9]+/)
    .map((token) => MONTHS[token] ?? token)
    .filter((token) => token.length > 0 && !JOINERS.has(token));
}

function expand(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\bm\s*\.?\s*s\s*\.?\s*w\s*\.?/g, " msw ")
    .replace(/\blicensed clinical social workers?\b/g, " lcsw ")
    .replace(/\bl\s*\.?\s*c\s*\.?\s*s\s*\.?\s*w\s*\.?/g, " lcsw ")
    .replace(/\bcertified public accountants?\b/g, " cpa ")
    .replace(/\bc\s*\.?\s*p\s*\.?\s*a\s*\.?/g, " cpa ")
    .replace(/\bnurse practitioners?\b/g, " np ")
    .replace(/\bregistered nurses?\b/g, " rn ")
    .replace(/%/g, " percent ");
}
