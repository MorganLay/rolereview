/**
 * Number tokens for the resume guard (G4) and the letter guard (L2).
 * docs/05-AI.md. `$50` and `50` differ. `20%` and `20` differ. `1,000` matches `1000`.
 */

function numberPattern(): RegExp {
  return /(?:\$(?:\s*)(?:\d{1,3}(?:[, ]\d{3})+|\d+)(?:\.\d+)?)|(?:\d{1,3}(?:[, ]\d{3})+(?:\.\d+)?(?:\s*%)?)|(?:\d+(?:\.\d+)?(?:\s*%)?)/g;
}

export function numberTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(numberPattern())) {
    const raw = match[0];
    if (raw === undefined) continue;
    tokens.push(normalizeToken(raw));
  }
  return tokens;
}

/** True when `text` contains a number token that none of `sources` contain. */
export function hasUnsupportedNumber(
  text: string,
  sources: readonly string[],
): boolean {
  const allowed = new Set(sources.flatMap((source) => numberTokens(source)));
  return numberTokens(text).some((token) => !allowed.has(token));
}

function normalizeToken(raw: string): string {
  const digits = raw.replace(/[^0-9.]/g, "");
  if (raw.includes("$")) return `$${digits}`;
  if (raw.includes("%")) return `${digits}%`;
  return digits;
}
