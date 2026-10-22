/**
 * Fabrication guard for a cover letter.
 * docs/05-AI.md → COVER_LETTER → Guard.
 * Pure: L1–L4 clean the model output before anything is saved.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";
import { hasUnsupportedNumber } from "@/lib/ai/numbers";

import {
  POSTING_REF,
  WHY_REF,
  type LetterOutput,
  type ValidatedLetterOutput,
  type ValidatedLetterParagraph,
} from "./schemas";

export const LETTER_GUARD_CODES = ["L1", "L2", "L3", "L4"] as const;

export type LetterGuardCode = (typeof LETTER_GUARD_CODES)[number];

/** A code and a ref id. Never paragraph text, posting text, or WHY notes. */
export type LetterGuardIssue = {
  code: LetterGuardCode;
  ref: string;
};

export type LetterGuardResult = {
  output: ValidatedLetterOutput;
  reverts: number;
  issues: LetterGuardIssue[];
};

export type LetterGuardInput = {
  snapshot: LibrarySnapshot;
  /** The same posting slice the model saw. */
  posting: string;
  whyCompany: string | null;
  requirementIds: readonly string[];
};

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "e.g",
  "i.e",
]);

type SnapshotEntry = LibrarySnapshot["entries"][number];

export function validateLetterOutput(
  output: LetterOutput,
  input: LetterGuardInput,
): LetterGuardResult {
  const why = providedWhy(input.whyCompany);
  const sources = sourceMap(input.snapshot);
  const issues: LetterGuardIssue[] = [];
  const paragraphs: ValidatedLetterParagraph[] = [];
  let reverts = 0;
  const last = output.paragraphs.length - 1;

  for (const [index, paragraph] of output.paragraphs.entries()) {
    const cleaned = cleanRefs(
      paragraph.sourceRefs,
      index,
      index === 0 || index === last,
      why,
      sources,
      issues,
    );
    if (paragraph.text.trim().length === 0 || cleaned.drop) continue;

    const checked = dropUnsupportedSentences(
      paragraph.text,
      textsFor(cleaned.refs, sources, input.posting, why),
    );
    if (checked.droppedSentence) {
      reverts += 1;
      issues.push({ code: "L2", ref: paragraphRef(index) });
    }
    if (checked.text.length === 0) continue;

    paragraphs.push({
      text: checked.text,
      sourceRefs: cleaned.refs,
      reverted: checked.droppedSentence,
      needsWhy: cleaned.needsWhy,
    });
  }

  return {
    output: {
      paragraphs,
      closing: output.closing,
      requirementIdsAddressed: cleanRequirementIds(
        output.requirementIdsAddressed,
        input.requirementIds,
        issues,
      ),
    },
    reverts,
    issues,
  };
}

function cleanRefs(
  sourceRefs: readonly string[],
  index: number,
  edge: boolean,
  why: string | null,
  sources: ReadonlyMap<string, string>,
  issues: LetterGuardIssue[],
): { refs: string[]; needsWhy: boolean; drop: boolean } {
  const refs: string[] = [];
  let strippedWhy = false;

  for (const ref of sourceRefs) {
    if (ref === WHY_REF) {
      if (why === null) {
        strippedWhy = true;
        continue;
      }
      if (!refs.includes(WHY_REF)) refs.push(WHY_REF);
      continue;
    }
    if (ref === POSTING_REF || sources.has(ref)) {
      if (!refs.includes(ref)) refs.push(ref);
      continue;
    }
    issues.push({ code: "L1", ref });
  }

  let needsWhy = false;
  if (strippedWhy) {
    issues.push({ code: "L3", ref: paragraphRef(index) });
    if (refs.length === 0) needsWhy = true;
  }

  const drop = refs.length === 0 && !needsWhy && !edge;
  if (drop) issues.push({ code: "L1", ref: paragraphRef(index) });
  return { refs, needsWhy, drop };
}

function dropUnsupportedSentences(
  text: string,
  sources: readonly string[],
): { text: string; droppedSentence: boolean } {
  const kept: string[] = [];
  let droppedSentence = false;
  for (const sentence of sentences(text)) {
    if (hasUnsupportedNumber(sentence, sources)) {
      droppedSentence = true;
      continue;
    }
    kept.push(sentence);
  }
  return { text: kept.join(" "), droppedSentence };
}

function cleanRequirementIds(
  ids: readonly string[],
  realIds: readonly string[],
  issues: LetterGuardIssue[],
): string[] {
  const real = new Set(realIds);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const id of ids) {
    if (!real.has(id)) {
      issues.push({ code: "L4", ref: id });
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    kept.push(id);
  }
  return kept;
}

function textsFor(
  refs: readonly string[],
  sources: ReadonlyMap<string, string>,
  posting: string,
  why: string | null,
): string[] {
  const texts: string[] = [];
  for (const ref of refs) {
    if (ref === POSTING_REF) {
      texts.push(posting);
      continue;
    }
    if (ref === WHY_REF) {
      if (why !== null) texts.push(why);
      continue;
    }
    const text = sources.get(ref);
    if (text !== undefined) texts.push(text);
  }
  return texts;
}

function sourceMap(snapshot: LibrarySnapshot): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of snapshot.entries) {
    map.set(entry.ref, entrySource(entry));
    for (const bullet of entry.bullets) map.set(bullet.ref, bullet.text);
  }
  for (const skill of snapshot.skills) map.set(skill.ref, skill.name);
  return map;
}

function entrySource(entry: SnapshotEntry): string {
  const parts = [
    entry.title,
    entry.organization,
    entry.location,
    entry.startDate,
    entry.endDate,
    ...entry.bullets.map((bullet) => bullet.text),
  ];
  return parts
    .filter((part): part is string => part !== null && part.trim().length > 0)
    .join("\n");
}

function providedWhy(why: string | null): string | null {
  if (why === null) return null;
  const trimmed = why.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function paragraphRef(index: number): string {
  return `p${index}`;
}

function sentences(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!isSentenceEnd(text, index)) continue;
    const sentence = text.slice(start, index + 1).trim();
    if (sentence.length > 0) parts.push(sentence);
    let next = index + 1;
    while (next < text.length && /\s/.test(text[next] ?? "")) next += 1;
    start = next;
    index = next - 1;
  }
  const tail = text.slice(start).trim();
  if (tail.length > 0) parts.push(tail);
  return parts;
}

/** `.`, `!`, or `?` followed by whitespace or the end. Decimals and abbreviations stay put. */
function isSentenceEnd(text: string, index: number): boolean {
  const mark = text[index];
  if (mark !== "." && mark !== "!" && mark !== "?") return false;
  const next = text[index + 1];
  if (next !== undefined && !/\s/.test(next)) return false;
  if (mark === "." && abbreviationBefore(text, index)) return false;
  return true;
}

function abbreviationBefore(text: string, periodIndex: number): boolean {
  const match = text.slice(0, periodIndex).match(/(?:[A-Za-z]\.)*[A-Za-z]+$/);
  const token = match?.[0];
  if (token === undefined) return false;
  return ABBREVIATIONS.has(token.toLowerCase());
}
