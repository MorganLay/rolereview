import type { Requirement } from "./schemas";

/**
 * Requirement text is stored in full. Older rows were cut at 80 or 90
 * characters, sometimes mid-word. A continuation is taken from the posting
 * only when that cut is a unique prefix of one sentence.
 */

const KNOWN_CLIP = new Set([80, 90]);

export function recoverRequirementText(text: string, posting: string): string {
  const stored = flatten(text);
  const source = flatten(posting);
  if (stored.length < 12 || source.length === 0) return stored;
  if (/[.!?]["']?$/.test(stored)) return stored;

  const needle = stored.toLowerCase();
  const haystack = source.toLowerCase();
  const start = haystack.indexOf(needle);
  if (start < 0) return stored;
  if (haystack.indexOf(needle, start + needle.length) !== -1) return stored;

  const next = source[start + stored.length] ?? "";
  const midWord = /[A-Za-z0-9]/.test(next);
  const clipped = KNOWN_CLIP.has(stored.length) && (next.length === 0 || /\s/.test(next) || midWord);
  if (!midWord && !clipped) return stored;

  const rest = source.slice(start + stored.length);
  const stop = rest.search(/[.!?]/);
  if (stop < 0 || stop > 400) return stored;
  const recovered = source.slice(start, start + stored.length + stop + 1).trim();
  return recovered.length > stored.length ? recovered : stored;
}

export function recoverRequirements(
  requirements: readonly Requirement[],
  posting: string,
): Requirement[] {
  return requirements.map((requirement) => {
    const text = recoverRequirementText(requirement.text, posting);
    return text === requirement.text ? requirement : { ...requirement, text };
  });
}

/** A saved gap that is a cut-off copy of a requirement gets that full text. */
export function restoreGapText(gap: string, requirements: readonly Requirement[]): string {
  const stored = flatten(gap);
  if (stored.length < 40) return stored;
  const match = requirements.find((requirement) => {
    const text = flatten(requirement.text);
    return text.length > stored.length && text.toLowerCase().startsWith(stored.toLowerCase());
  });
  return match ? flatten(match.text) : stored;
}

function flatten(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
