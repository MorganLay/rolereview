/**
 * Lightweight overlap hints within one experience. Precision over recall.
 * No network calls — safe to run while rendering the library.
 */

export type OverlapPair = {
  leftId: string;
  rightId: string;
  leftText: string;
  rightText: string;
  /** Shared content words that triggered the hint. */
  shared: string[];
};

const STOP = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "without",
  "via",
  "using",
  "used",
  "across",
  "over",
  "under",
  "per",
  "team",
  "teams",
  "work",
  "worked",
  "working",
  "role",
  "roles",
  "new",
  "also",
  "including",
  "include",
  "includes",
  "ensure",
  "ensured",
  "ensuring",
  "support",
  "supported",
  "supporting",
  "help",
  "helped",
  "helping",
  "provide",
  "provided",
  "providing",
  "manage",
  "managed",
  "managing",
  "lead",
  "led",
  "leading",
]);

const MIN_SHARED = 3;
const MIN_JACCARD = 0.42;
const MAX_PAIRS = 3;

export function findOverlappingBullets(
  bullets: readonly { id: string; text: string }[],
): OverlapPair[] {
  const pairs: OverlapPair[] = [];
  for (let i = 0; i < bullets.length; i += 1) {
    const left = bullets[i];
    if (!left) continue;
    const leftTokens = contentTokens(left.text);
    if (leftTokens.size < MIN_SHARED) continue;
    for (let j = i + 1; j < bullets.length; j += 1) {
      const right = bullets[j];
      if (!right) continue;
      const rightTokens = contentTokens(right.text);
      if (rightTokens.size < MIN_SHARED) continue;
      const shared = [...leftTokens].filter((token) => rightTokens.has(token));
      if (shared.length < MIN_SHARED) continue;
      const union = leftTokens.size + rightTokens.size - shared.length;
      const jaccard = union === 0 ? 0 : shared.length / union;
      if (jaccard < MIN_JACCARD) continue;
      pairs.push({
        leftId: left.id,
        rightId: right.id,
        leftText: left.text,
        rightText: right.text,
        shared: shared.sort(),
      });
      if (pairs.length >= MAX_PAIRS) return pairs;
    }
  }
  return pairs;
}

function contentTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9+%$#]+/)) {
    if (raw.length < 3) continue;
    if (STOP.has(raw)) continue;
    if (/^\d+$/.test(raw)) continue;
    tokens.add(raw);
  }
  return tokens;
}
