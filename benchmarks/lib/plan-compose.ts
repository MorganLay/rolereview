/**
 * Benchmark-only composition experiment.
 * Production compose is not called and is not changed.
 * Explicit omits stay off. A lead or support row does not waive grounding
 * or duplicate checks. Estimated line budgets are not applied here; the
 * caller measures the PDF afterward.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import { isRedundantBullet, sameWording, unsupportedClaim } from "@/features/tailor/grounding";
import { hasUnsupportedNumber } from "@/lib/ai/numbers";
import type { ContentBullet, ResumeContent } from "@/features/tailor/schemas";

import { phraseEquivalent } from "./phrases";

type SnapshotEntry = LibrarySnapshot["entries"][number];

export type PlanUse = "lead" | "support" | "omit";

export type PlanRow = {
  ref: string;
  use: PlanUse;
  bullets: number;
  because: string;
};

export type DraftEntry = {
  ref: string;
  bullets: string[];
};

export type ComposeOutcome =
  | "already_present"
  | "restored"
  | "unsupported"
  | "duplicate"
  | "omitted"
  | "heading_kept";

export type ComposeDecision = {
  ref: string;
  text: string | null;
  outcome: ComposeOutcome;
  detail: string;
};

export type CoverageDiscrepancy = {
  ref: string;
  because: string;
  destination: string | null;
  missing: string[];
  proposal: string;
};

const FACT_EXPANSIONS: Record<string, readonly string[]> = {
  je: ["journal entry", "journal entries"],
  jes: ["journal entry", "journal entries"],
  gl: ["general ledger"],
  pos: ["purchase order", "purchase orders"],
};

const CLAUSE_STOP = new Set([
  "with",
  "from",
  "that",
  "this",
  "and",
  "for",
  "the",
  "into",
  "using",
  "including",
  "across",
]);

export function experimentalComposition(input: {
  content: ResumeContent;
  snapshot: LibrarySnapshot;
  draft: readonly DraftEntry[];
  plan: readonly PlanRow[];
}): { content: ResumeContent; decisions: ComposeDecision[] } {
  const content = structuredClone(input.content);
  const decisions: ComposeDecision[] = [];
  const byRef = new Map(input.snapshot.entries.map((entry) => [entry.ref, entry]));
  const planByRef = new Map(input.plan.map((row) => [row.ref, row]));

  for (const row of input.plan) {
    if (row.use !== "omit") continue;
    const entry = content.entries.find((item) => item.ref === row.ref);
    if (entry) entry.included = false;
    const lines = input.draft.find((item) => item.ref === row.ref)?.bullets ?? [];
    if (lines.length === 0) {
      decisions.push({
        ref: row.ref,
        text: null,
        outcome: "omitted",
        detail: "The plan omitted this entry. The experiment leaves it off.",
      });
    }
    for (const text of lines) {
      decisions.push({
        ref: row.ref,
        text,
        outcome: "omitted",
        detail: "The plan omitted this entry. The draft line stays off.",
      });
    }
  }

  for (const draft of input.draft) {
    const row = planByRef.get(draft.ref);
    if (!row || row.use === "omit") continue;
    const entry = content.entries.find((item) => item.ref === draft.ref);
    const source = byRef.get(draft.ref);
    if (!entry || !source) continue;
    for (const text of draft.bullets) {
      const decision = placeDraftBullet(content, entry, source, text);
      decisions.push({ ref: draft.ref, text, ...decision });
      if (decision.outcome === "restored" || decision.outcome === "already_present") entry.included = true;
    }
  }

  for (const row of input.plan) {
    if (row.use !== "lead" && row.use !== "support") continue;
    const entry = content.entries.find((item) => item.ref === row.ref);
    const source = byRef.get(row.ref);
    if (!entry || !source || source.kind !== "EXPERIENCE") continue;
    if (entry.bullets.some((bullet) => bullet.included)) {
      entry.included = true;
      continue;
    }
    if (source.title.trim().length === 0) continue;
    entry.included = true;
    decisions.push({
      ref: row.ref,
      text: source.title,
      outcome: "heading_kept",
      detail: "The plan included this job. It has no grounded bullet, so only the source heading is kept until the page is measured.",
    });
  }

  return { content, decisions };
}

function placeDraftBullet(
  content: ResumeContent,
  entry: ResumeContent["entries"][number],
  source: SnapshotEntry,
  text: string,
): { outcome: ComposeOutcome; detail: string } {
  const support = supportFor(source, text);
  if (!support.ok) return { outcome: "unsupported", detail: support.detail };
  const existing = entry.bullets.find((bullet) => sameWording(bullet.text, text));
  if (existing?.included) {
    return { outcome: "already_present", detail: "The composed resume already includes this line." };
  }
  const duplicateOf = includedBulletTexts(content).find((prior) => sameWording(prior, text) || isRedundantBullet(prior, text));
  if (duplicateOf) {
    return { outcome: "duplicate", detail: "The line repeats another included bullet." };
  }
  if (existing) {
    existing.included = true;
    if (existing.sourceRefs.length === 0) existing.sourceRefs = support.refs;
    return {
      outcome: "restored",
      detail: "Turned the drafted line back on. A shared source ref is not a reason to drop a distinct grounded line.",
    };
  }
  entry.bullets.push(newBullet(entry.ref, entry.bullets.length, text, support.refs));
  return {
    outcome: "restored",
    detail: "Kept a distinct grounded draft line. A shared source ref is not a reason to drop it.",
  };
}

function supportFor(
  source: SnapshotEntry,
  text: string,
): { ok: true; refs: string[] } | { ok: false; detail: string } {
  const texts = source.bullets.map((bullet) => bullet.text);
  if (texts.length === 0) return { ok: false, detail: "The library entry has no bullet that can support a new line." };
  if (hasUnsupportedNumber(text, texts)) return { ok: false, detail: "The line contains a number the library bullet does not." };
  const claim = unsupportedClaim(text, texts);
  if (claim !== null) return { ok: false, detail: `The line adds “${claim}”, which the library bullet does not support.` };
  const own = source.bullets.filter(
    (bullet) => !hasUnsupportedNumber(text, [bullet.text]) && unsupportedClaim(text, [bullet.text]) === null,
  );
  const cited = own.length > 0 ? own : source.bullets;
  return { ok: true, refs: cited.map((bullet) => bullet.ref) };
}

function includedBulletTexts(content: ResumeContent): string[] {
  return content.entries.flatMap((entry) =>
    entry.included ? entry.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.text) : [],
  );
}

function newBullet(ref: string, index: number, text: string, sourceRefs: string[]): ContentBullet {
  return {
    id: `exp-${ref}-${index}`,
    text,
    included: true,
    sourceRefs,
    reverted: false,
    edited: false,
    originalText: null,
    suggestion: null,
    suggestionNote: null,
    changeWhat: null,
    requirementIds: [],
    sourceIds: sourceRefs,
  };
}

/**
 * When an omit says the evidence is represented elsewhere, check the resume
 * that was actually written. This does not put the omitted entry back.
 */
export function coverageDiscrepancies(input: {
  plan: readonly PlanRow[];
  snapshot: LibrarySnapshot;
  resumeText: string;
}): CoverageDiscrepancy[] {
  const byRef = new Map(input.snapshot.entries.map((entry) => [entry.ref, entry]));
  const found: CoverageDiscrepancy[] = [];
  for (const row of input.plan) {
    const claim = representationClaim(row.because);
    if (!claim) continue;
    if (row.use !== "omit" && row.bullets > 0) continue;
    const entry = byRef.get(row.ref);
    if (!entry) continue;
    const missing = claim.facts
      ? claim.facts.filter((fact) => !factPresent(input.resumeText, fact))
      : evidenceClauses(entry).filter((clause) => !clauseCovered(input.resumeText, clause));
    if (missing.length === 0) continue;
    found.push({
      ref: row.ref,
      because: row.because,
      destination: claim.destination,
      missing,
      proposal: proposalFor(row, claim.destination, missing),
    });
  }
  return found;
}

function representationClaim(because: string): { destination: string | null; facts: string[] | null } | null {
  const represented = because.match(/represented in the ([a-z0-9 ]+?)(?:\s+instead\b|[.]|$)/i);
  const already = because.match(/already shows?\s+([^.]+)/i);
  if (represented || already) {
    return {
      destination: represented?.[1]?.trim().toLowerCase() ?? null,
      facts: already ? splitFacts(already[1] ?? "") : null,
    };
  }
  if (/\bskills section\b/i.test(because) || /\bfeed the skills\b/i.test(because)) {
    return { destination: "skills section", facts: null };
  }
  return null;
}

function splitFacts(value: string): string[] {
  return value
    .split(/,|\/|\band\b|\bor\b/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function factPresent(resume: string, fact: string): boolean {
  if (resume.toLowerCase().includes(fact.toLowerCase())) return true;
  if (phraseEquivalent(resume, fact)) return true;
  const key = fact.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (FACT_EXPANSIONS[key] ?? []).some((item) => resume.toLowerCase().includes(item));
}

function evidenceClauses(entry: SnapshotEntry): string[] {
  const texts = entry.kind === "OTHER" ? entry.bullets.map((bullet) => bullet.text) : [entry.title, ...entry.bullets.map((bullet) => bullet.text)];
  return texts.flatMap(clausesOf);
}

function clausesOf(text: string): string[] {
  const clauses: string[] = [];
  for (const chunk of text.split(/[.;]+/)) {
    const pieces = chunk
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (pieces.length > 1) clauses.push(...pieces);
    else if (chunk.trim().length > 0) clauses.push(chunk.trim());
  }
  return clauses;
}

function clauseCovered(resume: string, clause: string): boolean {
  const hay = resume.toLowerCase();
  const acronyms = clause.match(/\b[A-Z]{2,}\b/g) ?? [];
  if (acronyms.some((token) => !hay.includes(token.toLowerCase()))) return false;
  const words = (clause.toLowerCase().match(/[a-z][a-z0-9+#.]{3,}/g) ?? []).filter((word) => !CLAUSE_STOP.has(word));
  if (words.length === 0) return true;
  const resumeWords = new Set(hay.match(/[a-z][a-z0-9+#.]{2,}/g) ?? []);
  return words.some((word) => wordCovered(resumeWords, word));
}

function wordCovered(resumeWords: ReadonlySet<string>, word: string): boolean {
  if (resumeWords.has(word)) return true;
  for (const token of resumeWords) {
    if (sameFamily(word, token)) return true;
  }
  return false;
}

function sameFamily(left: string, right: string): boolean {
  if (left === right) return true;
  const short = left.length <= right.length ? left : right;
  const long = left.length <= right.length ? right : left;
  if (short.length >= 5 && long.startsWith(short) && long.length - short.length <= 3) return true;
  let shared = 0;
  const limit = Math.min(left.length, right.length);
  while (shared < limit && left[shared] === right[shared]) shared += 1;
  if (shared < 6) return false;
  return left.length - shared <= 3 && right.length - shared <= 3;
}

function proposalFor(row: PlanRow, destination: string | null, missing: string[]): string {
  const named = missing.filter(distinctiveClause);
  const focus = named.length > 0 ? named : missing;
  const quoted = focus.map((item) => `“${item}”`).join("; ");
  const ordinary = missing.filter((item) => !focus.includes(item));
  const extra =
    ordinary.length > 0
      ? ` Ordinary source words are also absent and are not part of this correction: ${ordinary.join("; ")}.`
      : "";
  if (destination) {
    return `Keep ${row.ref} omitted as a heading. The plan said it was represented in the ${destination}, and these source clauses are not on the resume: ${quoted}. Add only those clauses to the ${destination}, in the source wording. Do not turn the omitted heading back on.${extra}`;
  }
  return `The plan omitted ${row.ref} because the resume already showed ${quoted}. Those facts are not on the resume. Do not treat the omit as covered until they are.${extra}`;
}

function distinctiveClause(clause: string): boolean {
  return /\b[A-Z]{2,}\b/.test(clause) || /[A-Z]/.test(clause);
}
