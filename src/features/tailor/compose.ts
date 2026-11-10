/**
 * Deterministic selection, order, and contact checks after the fabrication guard.
 * The model still writes the wording. This step does not invent facts.
 * docs/05-AI.md → Composing the resume.
 */

import { parseResumeDate } from "@/features/library/dates";
import { ENTRY_KINDS, type LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { KNOWN_TERMS } from "@/features/library/strength";

import { chooseEducationKeepers, canonicalUrl, classifyLink } from "./identity";
import { termAppears, normalizeMatchText } from "./keywords";
import type { EntryKind } from "./resume-shape";
import { resumeSectionOrder } from "./resume-shape";
import type {
  ResumeContact,
  ResumeReviewItem,
  ValidatedBullet,
  ValidatedTailorOutput,
} from "./schemas";

type SnapshotEntry = LibrarySnapshot["entries"][number];
type SnapshotBullet = SnapshotEntry["bullets"][number];

const HANDS_ON =
  /\b(built|implemented|designed|developed|architected|refactored|tested|validated|wrote|integrated)\b/i;
const GENERIC =
  /\b(responsible for|duties included|tasked with|helped with|assisted with|worked on|participated in)\b/i;
const ACADEMIC =
  /\b(coursework|course|assignment|class project|for a class|university course|academic)\b/i;
const UNFINISHED = /\b(in progress|not deployed|not yet|unfinished|planned to|prototype)\b/i;
const TECHNICAL_ROLE =
  /\b(software|engineer|developer|typescript|javascript|react|python|java|frontend|backend|full[- ]stack|github)\b/i;
const TERM_STOP = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "our",
  "into",
  "using",
]);

/** Lines for the page. A relevant entry may use more of this than a weak one. */
const BULLET_BUDGET = { 1: 14, 2: 22 } as const;
const STRONG_SCORE = 4;

export type Composition = {
  output: ValidatedTailorOutput;
  sectionOrder: EntryKind[];
  contacts: ResumeContact[];
  review: ResumeReviewItem[];
};

type Working = {
  ref: string;
  bullets: ValidatedBullet[];
  origin: "model" | "prioritized";
};

type ScoredBullet = {
  bullet: SnapshotBullet;
  score: number;
  generic: boolean;
  academic: boolean;
  handsOn: boolean;
};

export function composeResume(input: {
  output: ValidatedTailorOutput;
  snapshot: LibrarySnapshot;
  analysis: JobAnalysis;
  length: 1 | 2;
}): Composition {
  const byRef = new Map(input.snapshot.entries.map((entry) => [entry.ref, entry]));
  const terms = targetTerms(input.analysis);
  const review: ResumeReviewItem[] = [];
  const selected = new Map<string, Working>();

  for (const entry of input.output.entries) {
    if (!byRef.has(entry.ref) || selected.has(entry.ref)) continue;
    selected.set(entry.ref, {
      ref: entry.ref,
      bullets: entry.bullets.map((bullet) => ({ ...bullet, sourceRefs: [...bullet.sourceRefs] })),
      origin: "model",
    });
  }

  const education = chooseEducationKeepers(
    input.snapshot.entries,
    new Map([...selected].map(([ref, row]) => [ref, row.bullets.length])),
  );
  const duplicateRefs = new Set(education.drop.map((item) => item.ref));
  for (const ref of duplicateRefs) selected.delete(ref);
  const sameRole = dropSameStints(selected, byRef, input.snapshot.takenAt, terms);

  const droppedRelevance = new Set<string>();
  let added = 0;
  for (const entry of ranked(input.snapshot.entries, terms, input.snapshot.takenAt)) {
    if (entry.kind !== "PROJECT" || selected.has(entry.ref) || added >= 3) continue;
    if (stintAlreadySelected(entry, selected, byRef, input.snapshot.takenAt, terms)) continue;
    const scored = scoreBullets(entry, terms);
    const best = scored[0];
    if (!best || best.score < 4 || !best.handsOn || best.academic) continue;
    const weakestExperience = weakestSelectedExperience(selected, byRef, terms, input.snapshot.takenAt);
    if (weakestExperience !== null && best.score < weakestExperience + 2) continue;
    if (entryOverlap(entry, terms) < 1) continue;
    const chosen = scored.filter((item) => item.handsOn && !item.academic).slice(0, 4);
    selected.set(entry.ref, {
      ref: entry.ref,
      origin: "prioritized",
      bullets: chosen.map((item) => libraryBullet(item.bullet)),
    });
    added += 1;
  }

  let addedRoles = 0;
  for (const entry of ranked(input.snapshot.entries, terms, input.snapshot.takenAt)) {
    if (entry.kind !== "EXPERIENCE" || selected.has(entry.ref) || addedRoles >= 2) continue;
    if (stintAlreadySelected(entry, selected, byRef, input.snapshot.takenAt, terms)) continue;
    if (entryScore(entry, terms, input.snapshot.takenAt) < STRONG_SCORE) continue;
    if (entryOverlap(entry, terms) < 1) continue;
    const chosen = scoreBullets(entry, terms)
      .filter((item) => !item.academic && item.score >= 2)
      .slice(0, 4);
    if (chosen.length === 0) continue;
    selected.set(entry.ref, {
      ref: entry.ref,
      origin: "prioritized",
      bullets: chosen.map((item) => libraryBullet(item.bullet)),
    });
    addedRoles += 1;
  }

  for (const entry of input.snapshot.entries) {
    if (entry.kind !== "EXPERIENCE" || entry.isCurrent || !selected.has(entry.ref)) continue;
    const score = entryScore(entry, terms, input.snapshot.takenAt);
    const project = strongestSelectedProject(selected, byRef, terms, input.snapshot.takenAt);
    if (score <= 1 && project !== null && project >= 4) {
      selected.delete(entry.ref);
      droppedRelevance.add(entry.ref);
    }
  }

  const relevance = new Map(
    input.snapshot.entries.map((entry) => [entry.ref, entryScore(entry, terms, input.snapshot.takenAt)]),
  );
  const rankedSelected = [...selected.values()].sort(
    (left, right) => (relevance.get(right.ref) ?? 0) - (relevance.get(left.ref) ?? 0),
  );
  for (const row of rankedSelected) {
    const entry = byRef.get(row.ref);
    if (!entry) continue;
    row.bullets = preferBullets(entry, row.bullets, terms, review);
  }
  trimBudget(rankedSelected, byRef, terms, input.snapshot.takenAt, input.length, review);

  const experienceOrder = input.output.entries
    .filter((entry) => byRef.get(entry.ref)?.kind === "EXPERIENCE")
    .map((entry) => entry.ref);
  const orderedExperience = [...selected.values()]
    .map((row) => byRef.get(row.ref))
    .filter((entry): entry is SnapshotEntry => entry?.kind === "EXPERIENCE")
    .sort((left, right) => compareExperience(left, right));
  if (orderChanged(experienceOrder, orderedExperience.map((entry) => entry.ref))) {
    review.push({
      code: "ORDER_ADJUSTED",
      severity: "note",
      ref: "experience",
      reason: "chronology",
    });
  }

  const bestProject = strongestSelectedProject(selected, byRef, terms, input.snapshot.takenAt) ?? 0;
  const bestExperience = strongestSelectedExperience(selected, byRef, terms, input.snapshot.takenAt) ?? 0;
  const projectsLead = bestProject >= 4 && bestProject >= bestExperience + 2;
  const sectionOrder = projectsLead
    ? resumeSectionOrder(projectsBeforeExperience())
    : resumeSectionOrder([...ENTRY_KINDS]);
  review.push({
    code: "SECTION_ORDER",
    severity: "note",
    ref: "sections",
    reason: projectsLead ? "projects_lead" : "experience_leads",
  });

  const contacts = selectContacts(input.snapshot, selected, input.analysis, review);
  const skills = input.output.skills.map((group) => ({
    category: group.category,
    refs: [...group.refs],
  }));
  selectSkills(skills, input.snapshot, terms, review);

  for (const entry of input.snapshot.entries) {
    const row = selected.get(entry.ref);
    if (row) {
      review.push({
        code: "ENTRY_INCLUDED",
        severity: "note",
        ref: entry.ref,
        reason: row.origin === "prioritized" ? "prioritized" : "model_selected",
      });
      continue;
    }
    const missing = !hasSource(entry);
    const reason = duplicateRefs.has(entry.ref)
      ? "same_degree"
      : sameRole.has(entry.ref)
        ? "same_role"
        : droppedRelevance.has(entry.ref)
          ? "lower_relevance"
          : missing
            ? "missing_source"
            : "not_selected";
    review.push({ code: "ENTRY_EXCLUDED", severity: "note", ref: entry.ref, reason });
    if (entry.kind === "EXPERIENCE" && entry.isCurrent && !missing) {
      review.push({
        code: "CURRENT_ROLE_OMITTED",
        severity: "warning",
        ref: entry.ref,
        reason: "current_role_not_selected",
      });
    }
    if (duplicateRefs.has(entry.ref)) {
      review.push({
        code: "DUPLICATE_CONSOLIDATED",
        severity: "note",
        ref: entry.ref,
        reason: "same_degree",
      });
    }
  }

  const byKind = new Map<SnapshotEntry["kind"], Working[]>();
  for (const kind of ENTRY_KINDS) byKind.set(kind, []);
  const projectRank = new Map(
    input.snapshot.entries
      .filter((entry) => entry.kind === "PROJECT")
      .map((entry) => [entry.ref, entry] as const),
  );
  for (const row of selected.values()) {
    const entry = byRef.get(row.ref);
    if (!entry) continue;
    byKind.get(entry.kind)?.push(row);
  }
  const experiencePosition = new Map(orderedExperience.map((entry, index) => [entry.ref, index]));
  byKind.get("EXPERIENCE")?.sort(
    (left, right) => (experiencePosition.get(left.ref) ?? 0) - (experiencePosition.get(right.ref) ?? 0),
  );
  byKind.get("PROJECT")?.sort((left, right) => {
    const a = projectRank.get(left.ref);
    const b = projectRank.get(right.ref);
    if (!a || !b) return 0;
    return compareProjects(a, b, terms, input.snapshot.takenAt);
  });

  const entries: ValidatedTailorOutput["entries"] = [];
  for (const kind of sectionOrder) {
    for (const row of byKind.get(kind) ?? []) {
      entries.push({ ref: row.ref, bullets: row.bullets });
    }
  }

  return {
    output: { ...input.output, entries, skills },
    sectionOrder,
    contacts,
    review: review.slice(0, 80),
  };
}

/**
 * Two records of one job. Same employer, or the same project title, and overlapping dates.
 * "Def Hacks" and "Defhacks.co" are one employer. Different years at one employer stay separate.
 */
function dropSameStints(
  selected: Map<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  takenAt: string,
  terms: readonly string[],
): Set<string> {
  const dropped = new Set<string>();
  const refs = [...selected.keys()];
  for (let i = 0; i < refs.length; i += 1) {
    for (let j = i + 1; j < refs.length; j += 1) {
      const leftRef = refs[i];
      const rightRef = refs[j];
      if (!leftRef || !rightRef || dropped.has(leftRef) || dropped.has(rightRef)) continue;
      const left = byRef.get(leftRef);
      const right = byRef.get(rightRef);
      const leftRow = selected.get(leftRef);
      const rightRow = selected.get(rightRef);
      if (!left || !right || !leftRow || !rightRow || !sameStint(left, right, takenAt)) continue;
      const loser = richerStint(leftRow, rightRow, left, right);
      const loserEntry = loser === left.ref ? left : right;
      const winnerEntry = loser === left.ref ? right : left;
      if (addsJobTerm(loserEntry, winnerEntry, terms)) continue;
      dropped.add(loser);
      selected.delete(loser);
    }
  }
  return dropped;
}

function stintAlreadySelected(
  entry: SnapshotEntry,
  selected: ReadonlyMap<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  takenAt: string,
  terms: readonly string[],
): boolean {
  for (const ref of selected.keys()) {
    const other = byRef.get(ref);
    if (!other || !sameStint(entry, other, takenAt)) continue;
    if (addsJobTerm(entry, other, terms)) return false;
    return true;
  }
  return false;
}

function comparableText(text: string): string {
  return normalizeMatchText(text).replace(/\.+(?![a-z0-9])/g, " ");
}

function addsJobTerm(
  entry: SnapshotEntry,
  other: SnapshotEntry,
  terms: readonly string[],
): boolean {
  const entryText = comparableText(entry.bullets.map((bullet) => bullet.text).join("\n"));
  const otherText = comparableText(other.bullets.map((bullet) => bullet.text).join("\n"));
  return terms.some((term) => {
    const needle = normalizeMatchText(term);
    return needle.length >= 3 && termAppears(entryText, needle) && !termAppears(otherText, needle);
  });
}

function sameStint(left: SnapshotEntry, right: SnapshotEntry, takenAt: string): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "EDUCATION" || left.kind === "CERTIFICATION") return false;
  if (stintKey(left) !== stintKey(right)) return false;
  return datesOverlap(left, right, takenAt);
}

function stintKey(entry: SnapshotEntry): string {
  const org = orgKey(entry.organization ?? "");
  const label = org.length >= 4 ? org : orgKey(entry.title);
  return `${entry.kind}:${label}`;
}

function orgKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(com|co|ca|io|org|net)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function datesOverlap(left: SnapshotEntry, right: SnapshotEntry, takenAt: string): boolean {
  const a = span(left, takenAt);
  const b = span(right, takenAt);
  if (!a || !b) return true;
  return a.start <= b.end && b.start <= a.end;
}

function span(
  entry: SnapshotEntry,
  takenAt: string,
): { start: number; end: number } | null {
  const start = monthIndex(entry.startDate);
  if (start === null) return null;
  const end = entry.isCurrent
    ? monthIndex(takenAt.slice(0, 7)) ?? start
    : monthIndex(entry.endDate) ?? start;
  return { start, end: Math.max(start, end) };
}

function monthIndex(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseResumeDate(value);
  if (!parsed) return null;
  return parsed.year * 12 + (parsed.month ?? 1);
}

/** The ref to drop. Keep the record that already carries more of the role. */
function richerStint(
  left: Working,
  right: Working,
  leftEntry: SnapshotEntry,
  rightEntry: SnapshotEntry,
): string {
  if (left.bullets.length !== right.bullets.length) {
    return left.bullets.length > right.bullets.length ? right.ref : left.ref;
  }
  if (leftEntry.bullets.length !== rightEntry.bullets.length) {
    return leftEntry.bullets.length > rightEntry.bullets.length ? right.ref : left.ref;
  }
  return right.ref;
}

function projectsBeforeExperience(): EntryKind[] {
  const order: EntryKind[] = [];
  for (const kind of ENTRY_KINDS) {
    if (kind === "EXPERIENCE") order.push("PROJECT", "EXPERIENCE");
    else if (kind !== "PROJECT") order.push(kind);
  }
  return order;
}

function preferBullets(
  entry: SnapshotEntry,
  modelBullets: readonly ValidatedBullet[],
  terms: readonly string[],
  review: ResumeReviewItem[],
): ValidatedBullet[] {
  const scored = scoreBullets(entry, terms);
  const bySource = new Map(scored.map((item) => [item.bullet.ref, item]));
  const chosen: { bullet: ValidatedBullet; score: number }[] = [];
  const used = new Set<string>();
  for (const bullet of modelBullets) {
    if (bullet.sourceRefs.length === 0) continue;
    if (bullet.sourceRefs.every((ref) => used.has(ref))) continue;
    for (const ref of bullet.sourceRefs) used.add(ref);
    const score = bullet.sourceRefs.reduce(
      (best, ref) => Math.max(best, bySource.get(ref)?.score ?? 0),
      0,
    );
    chosen.push({ bullet, score });
  }

  const unused = scored.filter((item) => !used.has(item.bullet.ref));
  const strongest = unused[0];
  const weakestIndex = chosen.reduce(
    (best, item, index) => (item.score < (chosen[best]?.score ?? Infinity) ? index : best),
    0,
  );
  const weakest = chosen[weakestIndex];
  const weakestIsSingle = weakest?.bullet.sourceRefs.length === 1;
  const weakestSource = weakestIsSingle ? weakest.bullet.sourceRefs[0] : undefined;
  const weakestScore = weakestSource ? bySource.get(weakestSource) : undefined;
  if (
    strongest &&
    weakest &&
    weakestScore &&
    strongest.score >= weakest.score + 3 &&
    (weakestScore.generic || weakest.score <= 0)
  ) {
    const dropped = weakest.bullet.sourceRefs[0];
    chosen[weakestIndex] = { bullet: libraryBullet(strongest.bullet), score: strongest.score };
    if (dropped) {
      used.add(strongest.bullet.ref);
      review.push({
        code: "BULLET_PREFERENCE",
        severity: "note",
        ref: dropped,
        reason: "stronger_bullet",
      });
    }
  }

  chosen.sort((left, right) => right.score - left.score);
  return chosen.map((item) => item.bullet);
}

function trimBudget(
  rows: readonly Working[],
  byRef: ReadonlyMap<string, SnapshotEntry>,
  terms: readonly string[],
  takenAt: string,
  length: 1 | 2,
  review: ResumeReviewItem[],
): void {
  const budget = BULLET_BUDGET[length];
  const ranked = rows.map((row) => ({
    row,
    relevance: (() => {
      const entry = byRef.get(row.ref);
      return entry ? entryScore(entry, terms, takenAt) : 0;
    })(),
    scores: scoreMap(byRef.get(row.ref), terms),
  }));
  const total = () => ranked.reduce((sum, item) => sum + item.row.bullets.length, 0);
  const dropOne = (strongOnly: boolean): boolean => {
    const candidates = ranked
      .flatMap((item) =>
        item.row.bullets.map((bullet, index) => ({
          item,
          index,
          score: bulletScore(bullet, item.scores),
        })),
      )
      .filter((candidate) => candidate.item.row.bullets.length > 1)
      .filter((candidate) => (strongOnly ? candidate.score >= STRONG_SCORE : candidate.score < STRONG_SCORE))
      .sort(
        (left, right) =>
          left.score - right.score || left.item.relevance - right.item.relevance,
      );
    const top = ranked[0];
    const pick = candidates.find((candidate) => {
      if (!strongOnly || !top || candidate.item.row !== top.row) return true;
      return candidate.item.row.bullets.length > 3;
    });
    if (!pick) return false;
    const removed = pick.item.row.bullets[pick.index];
    pick.item.row.bullets = pick.item.row.bullets.filter((_, index) => index !== pick.index);
    const ref = removed?.sourceRefs[0];
    if (ref) {
      review.push({ code: "BULLET_PREFERENCE", severity: "note", ref, reason: "space" });
    }
    return true;
  };
  let guard = 0;
  while (total() > budget && guard < 40) {
    if (!dropOne(false) && !dropOne(true)) break;
    guard += 1;
  }
}

function scoreMap(
  entry: SnapshotEntry | undefined,
  terms: readonly string[],
): Map<string, number> {
  if (!entry) return new Map();
  return new Map(scoreBullets(entry, terms).map((item) => [item.bullet.ref, item.score]));
}

function bulletScore(bullet: ValidatedBullet, scores: ReadonlyMap<string, number>): number {
  return bullet.sourceRefs.reduce((best, ref) => Math.max(best, scores.get(ref) ?? 0), 0);
}

function entryOverlap(entry: SnapshotEntry, terms: readonly string[]): number {
  const blob = [entry.title, entry.organization ?? "", ...entry.bullets.map((bullet) => bullet.text)].join(
    " ",
  );
  return overlap(blob, terms);
}

function selectContacts(
  snapshot: LibrarySnapshot,
  selected: ReadonlyMap<string, Working>,
  analysis: JobAnalysis,
  review: ResumeReviewItem[],
): ResumeContact[] {
  const technical = roleIsTechnical(analysis);
  const kept: ResumeContact[] = [];
  const seen = new Set<string>();
  const kindsKept = new Set<ResumeContact["kind"]>();

  const consider = (
    label: string,
    url: string,
    reason: "verified_profile" | "entry_url",
  ) => {
    const kind = classifyLink(label, url);
    const canonical = canonicalUrl(url);
    if (kind === "invalid" || !canonical) {
      review.push({ code: "CONTACT_EXCLUDED", severity: "note", ref: label.slice(0, 40) || "link", reason: "invalid_url" });
      return;
    }
    if (kind === "not_contact") {
      review.push({ code: "CONTACT_EXCLUDED", severity: "note", ref: canonical.slice(0, 80), reason: "not_contact" });
      return;
    }
    if (seen.has(canonical)) {
      review.push({ code: "CONTACT_EXCLUDED", severity: "note", ref: canonical.slice(0, 80), reason: "duplicate_url" });
      return;
    }
    if (reason === "entry_url" && kindsKept.has(kind)) return;
    seen.add(canonical);
    kindsKept.add(kind);
    kept.push({
      label: label.trim().slice(0, 40),
      url: url.trim().slice(0, 300),
      kind,
      reason,
    });
  };

  for (const link of snapshot.profile.links) consider(link.label, link.url, "verified_profile");
  for (const entry of snapshot.entries) {
    if (!selected.has(entry.ref) || !entry.url) continue;
    consider(entry.title.trim() || "Project", entry.url, "entry_url");
  }

  const rank: Record<ResumeContact["kind"], number> = technical
    ? { github: 0, portfolio: 1, linkedin: 2, other: 3 }
    : { linkedin: 0, portfolio: 1, github: 2, other: 3 };
  kept.sort((left, right) => rank[left.kind] - rank[right.kind]);
  for (const link of kept) {
    review.push({
      code: "CONTACT_SELECTED",
      severity: "note",
      ref: canonicalUrl(link.url)?.slice(0, 80) ?? link.kind,
      reason: link.reason,
    });
  }
  return kept;
}

function selectSkills(
  skills: ValidatedTailorOutput["skills"],
  snapshot: LibrarySnapshot,
  terms: readonly string[],
  review: ResumeReviewItem[],
): void {
  const present = new Set(skills.flatMap((group) => group.refs));
  for (const skill of snapshot.skills) {
    const matched = terms.some(
      (term) =>
        termAppears(normalizeMatchText(skill.name), normalizeMatchText(term)) ||
        termAppears(normalizeMatchText(term), normalizeMatchText(skill.name)),
    );
    if (!matched) continue;
    const evidence = skillEvidence(skill.name, snapshot);
    if (!present.has(skill.ref)) {
      if (evidence !== "hands_on") {
        review.push({ code: "SKILL_EVIDENCE", severity: "note", ref: skill.ref, reason: evidence });
        continue;
      }
      const group = skills.find((item) => item.category === skill.category);
      if (group) group.refs.push(skill.ref);
      else skills.push({ category: skill.category, refs: [skill.ref] });
      present.add(skill.ref);
    }
    review.push({ code: "SKILL_EVIDENCE", severity: "note", ref: skill.ref, reason: evidence });
  }
}

function skillEvidence(
  name: string,
  snapshot: LibrarySnapshot,
): "hands_on" | "academic" | "name_only" {
  let academic = false;
  let handsOn = false;
  for (const entry of snapshot.entries) {
    for (const bullet of entry.bullets) {
      if (!termAppears(normalizeMatchText(bullet.text), normalizeMatchText(name))) continue;
      const course =
        entry.kind === "EDUCATION" || ACADEMIC.test(bullet.text) || UNFINISHED.test(bullet.text);
      const practice = HANDS_ON.test(bullet.text) && entry.kind !== "EDUCATION" && !ACADEMIC.test(bullet.text);
      if (practice) handsOn = true;
      else if (course) academic = true;
    }
  }
  if (handsOn) return "hands_on";
  if (academic) return "academic";
  return "name_only";
}

function libraryBullet(bullet: SnapshotBullet): ValidatedBullet {
  return { sourceRefs: [bullet.ref], text: bullet.text, reverted: false };
}

function scoreBullets(entry: SnapshotEntry, terms: readonly string[]): ScoredBullet[] {
  return entry.bullets
    .map((bullet) => {
      const handsOn = HANDS_ON.test(bullet.text);
      const generic = GENERIC.test(bullet.text) && !handsOn;
      const academic = ACADEMIC.test(bullet.text) || entry.kind === "EDUCATION";
      const unfinished = UNFINISHED.test(bullet.text);
      let score = 0;
      if (handsOn) score += 3;
      if (generic) score -= 3;
      if (academic) score -= 2;
      if (unfinished) score -= 1;
      score += overlap(bullet.text, terms) * 2;
      if (/\d/.test(bullet.text) && !academic) score += 1;
      if (hasKnownTerm(bullet.text)) score += 1;
      return { bullet, score, generic, academic, handsOn };
    })
    .sort((left, right) => right.score - left.score);
}

function entryScore(entry: SnapshotEntry, terms: readonly string[], takenAt: string): number {
  const scored = scoreBullets(entry, terms);
  const best = scored[0]?.score ?? 0;
  const title = `${entry.title} ${entry.organization ?? ""}`;
  let score = best + overlap(title, terms);
  const year = entryYear(entry, takenAt);
  const takenYear = Number(takenAt.slice(0, 4));
  if (year !== null && takenYear - year <= 1) score += 1;
  if (entry.kind === "PROJECT" && scored.some((item) => item.handsOn && !item.academic)) score += 1;
  return score;
}

function overlap(text: string, terms: readonly string[]): number {
  const haystack = normalizeMatchText(text);
  let count = 0;
  const seen = new Set<string>();
  for (const term of terms) {
    const needle = normalizeMatchText(term);
    if (needle.length < 2 || seen.has(needle)) continue;
    if (!termAppears(haystack, needle)) continue;
    seen.add(needle);
    count += 1;
  }
  return count;
}

function hasKnownTerm(text: string): boolean {
  const haystack = normalizeMatchText(text);
  for (const term of KNOWN_TERMS) {
    if (term.length < 3) continue;
    if (termAppears(haystack, term)) return true;
  }
  return false;
}

function targetTerms(analysis: JobAnalysis): string[] {
  const terms: string[] = [];
  for (const keyword of analysis.keywords) {
    const trimmed = keyword.trim();
    if (trimmed.length >= 2) terms.push(trimmed);
  }
  for (const requirement of analysis.requirements) {
    for (const token of requirement.text.split(/[^A-Za-z0-9+.#]+/)) {
      if (token.length < 3 || TERM_STOP.has(token.toLowerCase())) continue;
      terms.push(token);
    }
  }
  const title = analysis.title.trim();
  if (title.length >= 2) terms.push(title);
  return terms;
}

function roleIsTechnical(analysis: JobAnalysis): boolean {
  const blob = [analysis.title, ...analysis.keywords, ...analysis.requirements.map((item) => item.text)].join(
    " ",
  );
  return TECHNICAL_ROLE.test(blob);
}

function ranked(entries: readonly SnapshotEntry[], terms: readonly string[], takenAt: string): SnapshotEntry[] {
  return [...entries].sort(
    (left, right) => entryScore(right, terms, takenAt) - entryScore(left, terms, takenAt),
  );
}

function weakestSelectedExperience(
  selected: ReadonlyMap<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  terms: readonly string[],
  takenAt: string,
): number | null {
  let weakest: number | null = null;
  for (const ref of selected.keys()) {
    const entry = byRef.get(ref);
    if (!entry || entry.kind !== "EXPERIENCE" || entry.isCurrent) continue;
    const score = entryScore(entry, terms, takenAt);
    weakest = weakest === null ? score : Math.min(weakest, score);
  }
  return weakest;
}

function strongestSelectedProject(
  selected: ReadonlyMap<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  terms: readonly string[],
  takenAt: string,
): number | null {
  let best: number | null = null;
  for (const ref of selected.keys()) {
    const entry = byRef.get(ref);
    if (!entry || entry.kind !== "PROJECT") continue;
    const scored = scoreBullets(entry, terms);
    if (!scored.some((item) => item.handsOn && !item.academic)) continue;
    const score = entryScore(entry, terms, takenAt);
    best = best === null ? score : Math.max(best, score);
  }
  return best;
}

function strongestSelectedExperience(
  selected: ReadonlyMap<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  terms: readonly string[],
  takenAt: string,
): number | null {
  let best: number | null = null;
  for (const ref of selected.keys()) {
    const entry = byRef.get(ref);
    if (!entry || entry.kind !== "EXPERIENCE") continue;
    const score = entryScore(entry, terms, takenAt);
    best = best === null ? score : Math.max(best, score);
  }
  return best;
}

function compareProjects(
  left: SnapshotEntry,
  right: SnapshotEntry,
  terms: readonly string[],
  takenAt: string,
): number {
  const academic = (entry: SnapshotEntry) =>
    entry.bullets.length > 0 && entry.bullets.every((bullet) => ACADEMIC.test(bullet.text)) ? 1 : 0;
  const academicDelta = academic(left) - academic(right);
  if (academicDelta !== 0) return academicDelta;
  const scoreDelta = entryScore(right, terms, takenAt) - entryScore(left, terms, takenAt);
  if (scoreDelta !== 0) return scoreDelta;
  return dateRank(right, "end") - dateRank(left, "end");
}

function compareExperience(left: SnapshotEntry, right: SnapshotEntry): number {
  if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
  const end = dateRank(right, "end") - dateRank(left, "end");
  if (end !== 0) return end;
  return dateRank(right, "start") - dateRank(left, "start");
}

function dateRank(entry: SnapshotEntry, edge: "start" | "end"): number {
  if (edge === "end" && entry.isCurrent) return 100_000;
  const value = edge === "end" ? entry.endDate : entry.startDate;
  const parsed = value ? parseResumeDate(value) : null;
  if (!parsed) return 0;
  const month = parsed.month ?? (edge === "end" ? 12 : 1);
  return parsed.year * 12 + month;
}

function entryYear(entry: SnapshotEntry, takenAt: string): number | null {
  if (entry.isCurrent) {
    const year = Number(takenAt.slice(0, 4));
    return Number.isFinite(year) ? year : null;
  }
  const parsed = entry.endDate ? parseResumeDate(entry.endDate) : null;
  return parsed?.year ?? null;
}

function orderChanged(before: readonly string[], after: readonly string[]): boolean {
  const left = before.filter((ref) => after.includes(ref));
  const right = after.filter((ref) => left.includes(ref));
  return left.some((ref, index) => right[index] !== ref);
}

function hasSource(entry: SnapshotEntry): boolean {
  if (entry.title.trim().length > 0) return true;
  if ((entry.organization?.trim() ?? "").length > 0) return true;
  return entry.bullets.some((bullet) => bullet.text.trim().length > 0);
}
