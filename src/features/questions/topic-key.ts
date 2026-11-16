/**
 * Normalised topic keys. A later job can see that a topic was answered or declined.
 * The model may reuse a key it was shown. Otherwise the key is computed here.
 */

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "with",
  "for",
  "and",
  "or",
  "to",
  "in",
  "on",
  "at",
  "by",
  "from",
  "your",
  "you",
  "do",
  "did",
  "does",
  "how",
  "what",
  "that",
  "this",
  "into",
  "using",
  "use",
  "used",
  "via",
  "about",
  "their",
  "its",
  "experience",
  "system",
  "design",
  "development",
  "knowledge",
  "skill",
  "ability",
  "work",
]);

/** "REST API design" and "RESTful APIs" share a key. */
export function topicKey(subject: string, entryId: string | null): string {
  const tokens = topicTokens(subject);
  const slug = tokens.slice(0, 8).join("-") || "topic";
  return `${entryId ?? "general"}:${slug}`;
}

/**
 * Use the model's key only when it is one this person already has.
 * A new topic always uses the computed key.
 */
export function resolveTopicKey(
  modelKey: string | null,
  subject: string,
  entryId: string | null,
  known: ReadonlySet<string>,
): string {
  const cleaned = (modelKey ?? "").trim().toLowerCase();
  if (cleaned.length > 0 && known.has(cleaned)) return cleaned;
  return topicKey(subject, entryId);
}

export function topicTokens(subject: string): string[] {
  const folded = subject
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(foldToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  return [...new Set(folded)].sort();
}

function foldToken(token: string): string {
  let value = token;
  if (value.endsWith("ful") && value.length > 5) value = value.slice(0, -3);
  if (value.endsWith("ies") && value.length > 4) return `${value.slice(0, -3)}y`;
  if (/(?:s|x|z|ch|sh)es$/.test(value) && value.length > 4) return value.slice(0, -2);
  if (value.endsWith("s") && !value.endsWith("ss") && value.length > 3) return value.slice(0, -1);
  return value;
}
