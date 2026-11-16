/**
 * Keeps only questions that could change this resume.
 * A question is a hypothesis. Code drops the rest after the model call.
 */

import { hasUnsupportedNumber } from "@/lib/ai/numbers";
import { KNOWN_TERMS } from "@/features/library/strength";

import { resolveTopicKey } from "./topic-key";

export const QUESTION_KINDS = ["confirm", "detail", "scale", "outcome", "role"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const QUESTION_LIMIT = 6;

const PROTECTED =
  /\b(age|gender|sex|race|racial|ethnicity|religion|religious|disability|disabled|married|marital|pregnant|pregnancy|national origin|citizenship|sexual orientation|veteran status)\b/i;

const CONTENT_STOP = new Set([
  "with",
  "that",
  "this",
  "from",
  "your",
  "have",
  "what",
  "when",
  "where",
  "which",
  "would",
  "could",
  "about",
  "into",
  "does",
  "did",
  "how",
  "were",
  "was",
  "are",
  "the",
  "and",
  "for",
  "you",
  "your",
]);

export type ProposedQuestion = {
  requirementId: string;
  entryRef: string | null;
  kind: string;
  subject: string;
  topicKey: string | null;
  question: string;
  why: string;
};

export type QuestionEntry = {
  ref: string;
  id: string;
  title: string;
  bullets: readonly string[];
};

export type QuestionRequirement = {
  id: string;
  text: string;
  importance: "must" | "nice";
  kind: string;
};

export type SelectedQuestion = {
  requirementId: string;
  entryId: string | null;
  entryRef: string | null;
  kind: QuestionKind;
  subject: string;
  topicKey: string;
  question: string;
  why: string;
  importance: "must" | "nice";
};

export type QuestionProblem =
  | "shape"
  | "kind"
  | "requirement"
  | "entry"
  | "presuppose"
  | "protected"
  | "number"
  | "tool"
  | "repeat"
  | "topic";

export function selectJobQuestions(input: {
  proposed: readonly ProposedQuestion[];
  requirements: readonly QuestionRequirement[];
  entries: readonly QuestionEntry[];
  libraryText: string;
  postingText: string;
  knownTopicKeys: ReadonlySet<string>;
  limit?: number;
}): SelectedQuestion[] {
  const limit = input.limit ?? QUESTION_LIMIT;
  const kept: SelectedQuestion[] = [];
  const seen = new Set<string>();
  for (const proposed of input.proposed) {
    const selected = acceptQuestion(proposed, input);
    if (!selected) continue;
    if (seen.has(selected.topicKey) || input.knownTopicKeys.has(selected.topicKey)) continue;
    seen.add(selected.topicKey);
    kept.push(selected);
  }
  kept.sort((a, b) => {
    const rank = (item: SelectedQuestion) => (item.importance === "must" ? 0 : 1);
    return rank(a) - rank(b);
  });
  return kept.slice(0, limit);
}

/** Problems on one raw question, for the live eval. Empty means it can be asked. */
export function questionProblems(
  proposed: ProposedQuestion,
  input: {
    requirements: readonly QuestionRequirement[];
    entries: readonly QuestionEntry[];
    libraryText: string;
    postingText: string;
    knownTopicKeys: ReadonlySet<string>;
  },
): QuestionProblem[] {
  const problems: QuestionProblem[] = [];
  const question = cleanQuestion(proposed.question);
  if (!question) problems.push("shape");
  const kind = asKind(proposed.kind);
  if (!kind) problems.push("kind");
  const requirement = input.requirements.find((item) => item.id === proposed.requirementId);
  if (!requirement) problems.push("requirement");
  const entry = proposed.entryRef
    ? input.entries.find((item) => item.ref === proposed.entryRef)
    : null;
  if (proposed.entryRef && !entry) problems.push("entry");
  if (kind === "role" && !entry) problems.push("entry");
  if (question && presupposes(question)) problems.push("presuppose");
  if (question && PROTECTED.test(question)) problems.push("protected");
  if (question && hasUnsupportedNumber(question, [input.libraryText])) problems.push("number");
  if (question && kind && namesUnstatedTool(question, kind, input.libraryText, input.postingText)) {
    problems.push("tool");
  }
  if (question && repeatsLibrary(question, kind, proposed.subject, entry ?? null, input.entries)) {
    problems.push("repeat");
  }
  if (requirement && kind && question) {
    const entryId = entry?.id ?? null;
    const key = resolveTopicKey(proposed.topicKey, proposed.subject || question, entryId, input.knownTopicKeys);
    if (input.knownTopicKeys.has(key)) problems.push("topic");
  }
  return problems;
}

function acceptQuestion(
  proposed: ProposedQuestion,
  input: {
    requirements: readonly QuestionRequirement[];
    entries: readonly QuestionEntry[];
    libraryText: string;
    postingText: string;
    knownTopicKeys: ReadonlySet<string>;
  },
): SelectedQuestion | null {
  if (questionProblems(proposed, input).length > 0) return null;
  const question = cleanQuestion(proposed.question);
  const kind = asKind(proposed.kind);
  const requirement = input.requirements.find((item) => item.id === proposed.requirementId);
  if (!question || !kind || !requirement) return null;
  const entry = proposed.entryRef
    ? input.entries.find((item) => item.ref === proposed.entryRef) ?? null
    : null;
  const entryId = entry?.id ?? null;
  const why = clip(proposed.why, 160);
  if (why.length === 0) return null;
  return {
    requirementId: requirement.id,
    entryId,
    entryRef: entry?.ref ?? null,
    kind,
    subject: clip(proposed.subject, 80) || clip(question, 80),
    topicKey: resolveTopicKey(proposed.topicKey, proposed.subject || question, entryId, input.knownTopicKeys),
    question,
    why,
    importance: requirement.importance,
  };
}

export function cleanQuestion(value: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 8 || text.length > 300) return null;
  if (!text.endsWith("?")) return null;
  return text;
}

export function presupposes(question: string): boolean {
  const text = question.trim();
  if (/^(you|your|they|the candidate)\b/i.test(text)) return true;
  if (/\b(didn't you|did you not|right|correct)\s*\??$/i.test(text)) return true;
  return false;
}

function asKind(value: string): QuestionKind | null {
  return QUESTION_KINDS.includes(value as QuestionKind) ? (value as QuestionKind) : null;
}

function namesUnstatedTool(
  question: string,
  kind: QuestionKind,
  libraryText: string,
  postingText: string,
): boolean {
  for (const term of toolsIn(question)) {
    if (mentions(libraryText, term)) continue;
    if (kind === "confirm" && mentions(postingText, term)) continue;
    return true;
  }
  return false;
}

function toolsIn(question: string): string[] {
  const found = new Set<string>();
  for (const term of KNOWN_TERMS) {
    if (mentions(question, term)) found.add(term);
  }
  for (const match of question.matchAll(/\b[A-Z]{2,}[A-Z0-9+#.]*/g)) {
    const token = match[0];
    if (token) found.add(token);
  }
  for (const match of question.matchAll(/\b[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*/g)) {
    const token = match[0];
    if (token) found.add(token);
  }
  return [...found];
}

function repeatsLibrary(
  question: string,
  kind: QuestionKind | null,
  subject: string,
  entry: QuestionEntry | null,
  entries: readonly QuestionEntry[],
): boolean {
  const bullets = entry ? entry.bullets : entries.flatMap((item) => [...item.bullets]);
  const asked = contentTokens(question);
  if (asked.size >= 4) {
    for (const bullet of bullets) {
      const source = contentTokens(bullet);
      if (source.size < 4) continue;
      const shared = [...asked].filter((token) => source.has(token)).length;
      if (shared / asked.size >= 0.72) return true;
    }
  }
  if (kind === "confirm") {
    const hay = bullets.join("\n").toLowerCase();
    const needle = subject.trim().toLowerCase();
    if (needle.length >= 2 && hay.includes(needle)) return true;
    const subjectTokens = contentTokens(subject);
    if (subjectTokens.size > 0 && [...subjectTokens].every((token) => hay.includes(token))) {
      return true;
    }
  }
  return false;
}

function contentTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !CONTENT_STOP.has(token));
  return new Set(tokens);
}

function mentions(text: string, term: string): boolean {
  const hay = text.toLowerCase();
  const needle = term.toLowerCase();
  if (needle.length === 0) return false;
  let from = 0;
  while (from <= hay.length) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : hay[at - 1] ?? "";
    const after = hay[at + needle.length] ?? "";
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = at + needle.length;
  }
  return false;
}

function isWordChar(value: string): boolean {
  return /[a-z0-9+#]/i.test(value);
}

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).trim() : text;
}
