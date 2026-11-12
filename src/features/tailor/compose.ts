/**
 * Deterministic selection, order, and contact checks after the fabrication guard.
 * The model still writes the wording. This step does not invent facts.
 * docs/05-AI.md → Composing the resume.
 */

import { parseResumeDate } from "@/features/library/dates";
import { ENTRY_KINDS, type LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { parseSkillQualifier } from "@/features/library/skill-qualifier";
import { KNOWN_TERMS } from "@/features/library/strength";

import { requirementTerms } from "./coverage";
import { canonicalizeCareer, entryDisplay, unresolvedStintPairs, type CareerConfirmation, type EntryDisplay } from "./canonical";
import { coversExtraMust, dominates, evidenceSubstance } from "./overlap";
import { sameWording } from "./grounding";
import { chooseEducationKeepers, canonicalUrl, classifyLink } from "./identity";
import { termAppears, normalizeMatchText } from "./keywords";
import { jobHeadline } from "./presentation";
import { groupMembers } from "./stints";
import type { EntryKind } from "./resume-shape";
import { resumeSectionOrder } from "./resume-shape";
import type {
  EditorialPlan,
  ResumeContact,
  ResumeReviewItem,
  ValidatedBullet,
  ValidatedTailorOutput,
} from "./schemas";

type SnapshotEntry = LibrarySnapshot["entries"][number];
type SnapshotBullet = SnapshotEntry["bullets"][number];

const HANDS_ON =
  /\b(built|implemented|designed|developed|architected|refactored|tested|validated|wrote|integrated|maintained|collected|collect|mapped|digitized|digitised|published|produced|created|queried|surveyed|processed|standardized|standardised|updated)\b/i;
const GENERIC =
  /\b(responsible for|duties included|tasked with|helped with|assisted with|worked on|participated in)\b/i;
const ACADEMIC =
  /\b(coursework|course|assignment|class project|for a class|university course|academic)\b/i;
const UNFINISHED = /\b(in progress|not deployed|not yet|unfinished|planned to|prototype)\b/i;
const TECHNICAL_ROLE =
  /\b(software|engineer|developer|typescript|javascript|react|python|java|frontend|backend|full[- ]stack|github|gis|arcgis|qgis|geospatial)\b/i;
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
  presentation: Record<string, EntryDisplay>;
  stints: { canonical: string; members: string[] }[];
  headline: string | null;
  pageLimit: 1 | 2;
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
  confirmations?: readonly CareerConfirmation[];
}): Composition {
  const byRef = new Map(input.snapshot.entries.map((entry) => [entry.ref, entry]));
  const terms = targetTerms(input.analysis);
  const review: ResumeReviewItem[] = [];
  const selected = new Map<string, Working>();
  const confirmations = input.confirmations ?? [];
  const career = canonicalizeCareer(input.snapshot.entries, input.snapshot.takenAt, confirmations);
  const confirmed = career.stints
    .filter((stint) => stint.members.length > 1)
    .map((stint) => stint.members);

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
  const musts = mustHaveTerms(input.analysis);
  const sameRole = foldGroups(selected, input.snapshot, byRef, career.stints);
  absorbGroupFacts(selected, input.snapshot, byRef, musts, input.analysis.keywords, confirmed, input.output.plan);

  const directed = hasStrategy(input.output.plan);
  const droppedRelevance = new Set<string>();
  const strategyOmit = new Set<string>();
  let covered = new Set<string>();
  if (directed) {
    for (const ref of applyStrategy(selected, input.output.plan, input.snapshot, byRef, confirmed)) {
      strategyOmit.add(ref);
    }
    fillStrategyLines(selected, input.output.plan, input.snapshot, byRef, terms, confirmed);
  } else {
    let added = 0;
    for (const entry of ranked(input.snapshot.entries, terms, input.snapshot.takenAt)) {
      if (entry.kind !== "PROJECT" || selected.has(entry.ref) || added >= 3) continue;
      if (groupAlreadySelected(entry, selected, input.snapshot, confirmed)) continue;
      const scored = scoreBullets(entry, terms);
      const best = scored[0];
      if (!best || best.score < 4 || !best.handsOn || best.academic) continue;
      const weakestExperience = weakestSelectedExperience(selected, byRef, terms, input.snapshot.takenAt);
      if (weakestExperience !== null && best.score < weakestExperience + 2) continue;
      const projectCount = countKind(selected, byRef, "PROJECT");
      if (projectCount === 0) {
        if (entryOverlap(entry, terms) < 1) continue;
      } else if (!addsEvidence(entry, coveredBlob(selected, byRef), input.length === 1 ? musts : [...musts, ...input.analysis.keywords])) {
        continue;
      }
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
      if (groupAlreadySelected(entry, selected, input.snapshot, confirmed)) continue;
      if (entryScore(entry, terms, input.snapshot.takenAt) < STRONG_SCORE) continue;
      const roleCount = countKind(selected, byRef, "EXPERIENCE");
      if (roleCount === 0) {
        if (entryOverlap(entry, terms) < 1) continue;
      } else if (!addsEvidence(entry, coveredBlob(selected, byRef), musts)) {
        continue;
      }
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
    const replaced = replaceWeakProject(selected, byRef, input.snapshot, terms);
    covered = new Set([
      ...replaced,
      ...pruneProjects(selected, byRef, input.snapshot, musts, input.analysis.keywords, input.length, terms),
    ]);

    for (const entry of input.snapshot.entries) {
      if (entry.kind !== "EXPERIENCE" || entry.isCurrent || !selected.has(entry.ref)) continue;
      const score = entryScore(entry, terms, input.snapshot.takenAt);
      const project = strongestSelectedProject(selected, byRef, terms, input.snapshot.takenAt);
      if (score <= 1 && project !== null && project >= 4) {
        selected.delete(entry.ref);
        droppedRelevance.add(entry.ref);
      }
    }
    if (countKind(selected, byRef, "EXPERIENCE") === 0) {
      for (const entry of ranked(input.snapshot.entries, terms, input.snapshot.takenAt)) {
        if (entry.kind !== "EXPERIENCE" || selected.has(entry.ref)) continue;
        if (entryOverlap(entry, terms) < 1) continue;
        if (entryScore(entry, terms, input.snapshot.takenAt) < STRONG_SCORE) continue;
        const chosen = scoreBullets(entry, terms)
          .filter((item) => !item.academic && item.score >= 2)
          .slice(0, 4);
        if (chosen.length === 0) continue;
        selected.set(entry.ref, {
          ref: entry.ref,
          origin: "prioritized",
          bullets: chosen.map((item) => libraryBullet(item.bullet)),
        });
        break;
      }
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
    row.bullets = distinctFacts(
      preferBullets(
        withGroupBullets(entry, input.snapshot, confirmed),
        row.bullets,
        terms,
        musts,
        review,
        directed,
      ),
    );
  }
  if (!directed && roleIsTechnical(input.analysis)) {
    addPracticedProjectBullets(rankedSelected, byRef, input.snapshot, terms, confirmed);
    capPeripheralExperience(rankedSelected, byRef, terms);
  }
  trimBudget(
    rankedSelected,
    byRef,
    terms,
    input.snapshot,
    input.length,
    musts,
    review,
    directed ? strategyWeights(input.output.plan, input.snapshot, selected, confirmed) : undefined,
  );
  const marginal = dropNoMarginal(selected, byRef, input.output.plan, musts, input.snapshot, confirmed);
  const pageBudget = dropEmpty(selected, byRef);

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
  const projectsLead = directed
    ? strategyProjectsLead(input.output.plan, byRef)
    : bestProject >= 4 && bestProject >= bestExperience + 2;
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
  pruneUnevidencedSkills(skills, input.snapshot, selected, input.analysis, review);

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
        : strategyOmit.has(entry.ref)
          ? "strategy_omit"
          : marginal.has(entry.ref)
            ? "no_marginal_value"
          : covered.has(entry.ref)
            ? "covered"
          : pageBudget.has(entry.ref)
            ? "page_budget"
            : droppedRelevance.has(entry.ref)
              ? "lower_relevance"
              : missing
                ? "missing_source"
                : "not_selected";
    review.push({
      code: "ENTRY_EXCLUDED",
      severity: reason === "page_budget" ? "warning" : "note",
      ref: entry.ref,
      reason,
    });
    if (sameRole.has(entry.ref)) {
      review.push({
        code: "DUPLICATE_CONSOLIDATED",
        severity: "note",
        ref: entry.ref,
        reason: "same_role",
      });
    }
    if (entry.kind === "EXPERIENCE" && entry.isCurrent && !missing && reason !== "same_role") {
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
  const projectOrder = directed
    ? strategyOrder(input.output.plan, input.snapshot, selected, confirmed)
    : null;
  byKind.get("PROJECT")?.sort((left, right) => {
    if (projectOrder) return (projectOrder.get(left.ref) ?? 99) - (projectOrder.get(right.ref) ?? 99);
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

  const presentation: Record<string, EntryDisplay> = {};
  for (const row of selected.values()) {
    const entry = byRef.get(row.ref);
    if (!entry) continue;
    const stint = career.stints.find((item) => item.members.includes(row.ref));
    const display = entryDisplay(entry, stint);
    if (!display) continue;
    presentation[row.ref] = display;
    if (entry.kind === "PROJECT" && display.displayTitle && display.displayTitle !== entry.title.trim()) {
      review.push({
        code: "PRESENTATION",
        severity: "note",
        ref: row.ref,
        reason: "project_name",
      });
    }
  }
  for (const stint of career.stints) {
    if (stint.conflicts.length === 0) continue;
    if (!stint.members.some((ref) => selected.has(ref))) continue;
    review.push({
      code: "PRESENTATION",
      severity: "warning",
      ref: stint.canonical,
      reason: "fact_conflict",
    });
  }
  for (const pair of unresolvedStintPairs(input.snapshot.entries, input.snapshot.takenAt, confirmations)) {
    review.push({
      code: "PRESENTATION",
      severity: "warning",
      ref: pair[0] ?? "stint",
      reason: "unresolved_dates",
    });
  }
  for (const members of career.rejected) {
    review.push({
      code: "PRESENTATION",
      severity: "warning",
      ref: members[0] ?? "confirmation",
      reason: "confirmation_rejected",
    });
  }
  if (input.length === 2) {
    review.push({
      code: "PRESENTATION",
      severity: "note",
      ref: "length",
      reason: "within_ceiling",
    });
  }
  const headline = jobHeadline(input.output.plan, input.snapshot, input.analysis.title);
  if (headline) {
    review.push({
      code: "PRESENTATION",
      severity: "note",
      ref: "headline",
      reason: "job_headline",
    });
  }

  return {
    output: { ...input.output, entries, skills },
    sectionOrder,
    contacts,
    review: review.slice(0, 80),
    presentation,
    stints: career.stints.map((stint) => ({ canonical: stint.canonical, members: stint.members })),
    headline,
    pageLimit: input.length,
  };
}

function hasStrategy(plan: EditorialPlan | undefined): boolean {
  return (plan?.evidence?.length ?? 0) > 0;
}

/** Follow the strategy's omissions and line counts. Do not add an entry the draft left out. */
function applyStrategy(
  selected: Map<string, Working>,
  plan: EditorialPlan | undefined,
  snapshot: LibrarySnapshot,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  confirmed: readonly (readonly string[])[],
): Set<string> {
  const removed = new Set<string>();
  const directive = new Map<string, { use: "lead" | "support" | "omit"; bullets: number }>();
  for (const row of plan?.evidence ?? []) {
    const key = headingRef(row.ref, snapshot, selected, confirmed);
    const entry = byRef.get(key);
    if (!entry || entry.kind === "EDUCATION") continue;
    const rank = row.use === "lead" ? 3 : row.use === "support" ? 2 : 1;
    const previous = directive.get(key);
    const previousRank = previous?.use === "lead" ? 3 : previous?.use === "support" ? 2 : previous ? 1 : 0;
    if (previous && previousRank > rank) continue;
    directive.set(key, { use: row.use, bullets: row.bullets });
  }
  for (const [ref, row] of directive) {
    if (row.use === "omit" || row.bullets <= 0) {
      if (selected.delete(ref)) removed.add(ref);
      continue;
    }
    const current = selected.get(ref);
    if (!current) continue;
    const cap = Math.min(6, row.bullets);
    if (current.bullets.length > cap) current.bullets = current.bullets.slice(0, cap);
  }
  return removed;
}

/** Bring unused library lines up to the count the strategy already chose. */
function fillStrategyLines(
  selected: Map<string, Working>,
  plan: EditorialPlan | undefined,
  snapshot: LibrarySnapshot,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  terms: readonly string[],
  confirmed: readonly (readonly string[])[],
): void {
  for (const row of plan?.evidence ?? []) {
    if (row.use === "omit" || row.bullets <= 0) continue;
    const key = headingRef(row.ref, snapshot, selected, confirmed);
    const current = selected.get(key);
    const entry = byRef.get(key);
    if (!current || !entry || current.bullets.length >= row.bullets) continue;
    const cited = new Set(current.bullets.flatMap((bullet) => bullet.sourceRefs));
    const unused = withGroupBullets(entry, snapshot, confirmed).bullets.filter(
      (bullet) => !cited.has(bullet.ref) && !ACADEMIC.test(bullet.text),
    );
    unused.sort((left, right) => {
      const generic = (GENERIC.test(left.text) ? 1 : 0) - (GENERIC.test(right.text) ? 1 : 0);
      return generic || overlap(right.text, terms) - overlap(left.text, terms);
    });
    for (const bullet of unused) {
      if (current.bullets.length >= Math.min(6, row.bullets)) break;
      if (current.bullets.some((existing) => sameFact(existing.text, bullet.text))) continue;
      current.bullets.push(libraryBullet(bullet));
    }
  }
}

function strategyWeights(
  plan: EditorialPlan | undefined,
  snapshot: LibrarySnapshot,
  selected: ReadonlyMap<string, Working>,
  confirmed: readonly (readonly string[])[],
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const row of plan?.evidence ?? []) {
    const key = headingRef(row.ref, snapshot, selected, confirmed);
    const weight = row.use === "lead" ? 2 : row.use === "support" ? 1 : 0;
    weights.set(key, Math.max(weights.get(key) ?? 0, weight));
  }
  return weights;
}

function strategyProjectsLead(
  plan: EditorialPlan | undefined,
  byRef: ReadonlyMap<string, SnapshotEntry>,
): boolean {
  const lead = plan?.evidence?.find((row) => row.use === "lead");
  return byRef.get(lead?.ref ?? "")?.kind === "PROJECT";
}

function strategyOrder(
  plan: EditorialPlan | undefined,
  snapshot: LibrarySnapshot,
  selected: ReadonlyMap<string, Working>,
  confirmed: readonly (readonly string[])[],
): Map<string, number> {
  const order = new Map<string, number>();
  for (const [index, row] of (plan?.evidence ?? []).entries()) {
    const key = headingRef(row.ref, snapshot, selected, confirmed);
    if (!order.has(key)) order.set(key, index);
  }
  return order;
}

function headingRef(
  ref: string,
  snapshot: LibrarySnapshot,
  selected: ReadonlyMap<string, Working>,
  confirmed: readonly (readonly string[])[] = [],
): string {
  const members = groupMembers(snapshot.entries, snapshot.takenAt, ref, confirmed);
  return members.find((member) => selected.has(member)) ?? members[0] ?? ref;
}

/** One heading per verified group. Sibling records stay in the library, off the page. */
function foldGroups(
  selected: Map<string, Working>,
  snapshot: LibrarySnapshot,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  stints: readonly { canonical: string; members: string[] }[],
): Set<string> {
  const hidden = new Set<string>();
  for (const group of stints) {
    if (group.members.length < 2) continue;
    const present = group.members.filter((ref) => selected.has(ref));
    if (present.length === 0) continue;
    const heading = byRef.has(group.canonical) ? group.canonical : present[0];
    if (!heading) continue;
    const row = selected.get(heading) ?? {
      ref: heading,
      origin: present.some((ref) => selected.get(ref)?.origin === "model") ? "model" : "prioritized",
      bullets: [],
    };
    for (const ref of present) {
      if (ref === heading) continue;
      const other = selected.get(ref);
      if (other) row.bullets.push(...other.bullets);
      selected.delete(ref);
      hidden.add(ref);
    }
    row.bullets = distinctFacts(row.bullets);
    selected.set(heading, row);
  }
  return hidden;
}

function absorbGroupFacts(
  selected: Map<string, Working>,
  snapshot: LibrarySnapshot,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  musts: readonly string[],
  keywords: readonly string[],
  confirmed: readonly (readonly string[])[],
  plan: EditorialPlan | undefined,
): void {
  const terms = [...musts, ...keywords];
  for (const row of selected.values()) {
    const entry = byRef.get(row.ref);
    if (!entry) continue;
    const members = groupMembers(snapshot.entries, snapshot.takenAt, row.ref, confirmed);
    if (members.length < 2) continue;
    const cap = planCap(plan, members);
    const cited = new Set(row.bullets.flatMap((bullet) => bullet.sourceRefs));
    const fromSibling = [...cited].some((ref) => !entry.bullets.some((bullet) => bullet.ref === ref));
    const candidates: SnapshotBullet[] = [];
    for (const ref of members) {
      if (ref === row.ref && !fromSibling) continue;
      const sibling = byRef.get(ref);
      if (!sibling) continue;
      for (const bullet of sibling.bullets) {
        if (cited.has(bullet.ref)) continue;
        if (row.bullets.some((kept) => sameFact(kept.text, bullet.text))) continue;
        candidates.push(bullet);
      }
    }
    const covered = row.bullets.map((bullet) => bullet.text).join(" ");
    const rankedFacts = candidates
      .map((bullet) => ({
        bullet,
        added: addedTerms(bullet.text, covered, terms).length + (newKnownTool(bullet.text, covered) ? 2 : 0),
      }))
      .filter((item) => item.added > 0 || uniqueNumber(item.bullet.text, covered))
      .sort((left, right) => right.added - left.added)
      .slice(0, 3);
    for (const item of rankedFacts) {
      if (cap !== null && row.bullets.length >= cap) break;
      row.bullets.push(libraryBullet(item.bullet));
    }
    row.bullets = distinctFacts(row.bullets);
  }
}

function planCap(plan: EditorialPlan | undefined, members: readonly string[]): number | null {
  let cap: number | null = null;
  for (const row of plan?.evidence ?? []) {
    if (!members.includes(row.ref)) continue;
    if (row.use === "omit") return 0;
    const next = Math.min(6, Math.max(0, row.bullets));
    cap = cap === null ? next : Math.max(cap, next);
  }
  return cap;
}

const GENERIC_EVIDENCE = new Set([
  "data",
  "team",
  "work",
  "support",
  "process",
  "service",
  "customer",
  "business",
  "project",
  "system",
  "using",
  "role",
  "year",
  "years",
  "experience",
  "information",
  "management",
  "analysis",
]);

/** Drop a selected entry the plan did not ask to keep when it shows no requirement. */
function dropNoMarginal(
  selected: Map<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  plan: EditorialPlan | undefined,
  musts: readonly string[],
  snapshot: LibrarySnapshot,
  confirmed: readonly (readonly string[])[],
): Set<string> {
  const dropped = new Set<string>();
  if ((plan?.evidence?.length ?? 0) === 0) return dropped;
  const specific = musts.filter((term) => {
    const needle = normalizeMatchText(term);
    return needle.length >= 3 && !GENERIC_EVIDENCE.has(needle);
  });
  if (specific.length === 0) return dropped;
  for (const [ref, row] of [...selected]) {
    const entry = byRef.get(ref);
    if (!entry || entry.kind === "EDUCATION") continue;
    const use = planUse(plan, ref, snapshot, confirmed);
    if (use === "lead" || use === "support") continue;
    const blob = normalizeMatchText(row.bullets.map((bullet) => bullet.text).join(" "));
    const shown = specific.some((term) => termAppears(blob, normalizeMatchText(term)));
    if (shown) continue;
    selected.delete(ref);
    dropped.add(ref);
  }
  return dropped;
}

function planUse(
  plan: EditorialPlan | undefined,
  ref: string,
  snapshot: LibrarySnapshot,
  confirmed: readonly (readonly string[])[],
): "lead" | "support" | "omit" | null {
  const members = new Set(groupMembers(snapshot.entries, snapshot.takenAt, ref, confirmed));
  let best: "lead" | "support" | "omit" | null = null;
  let rank = 0;
  for (const row of plan?.evidence ?? []) {
    if (!members.has(row.ref)) continue;
    const next = row.use === "lead" ? 3 : row.use === "support" ? 2 : 1;
    if (next <= rank) continue;
    rank = next;
    best = row.use;
  }
  return best;
}

function pruneUnevidencedSkills(
  skills: ValidatedTailorOutput["skills"],
  snapshot: LibrarySnapshot,
  selected: ReadonlyMap<string, Working>,
  analysis: JobAnalysis,
  review: ResumeReviewItem[],
): void {
  const included = [...selected.values()].flatMap((row) => row.bullets.map((bullet) => bullet.text)).join("\n");
  const posting = [analysis.title, ...analysis.keywords, ...analysis.requirements.map((item) => item.text)].join(
    "\n",
  );
  const work = normalizeMatchText(included);
  const asked = normalizeMatchText(posting);
  for (const group of skills) {
    group.refs = group.refs.filter((ref) => {
      const skill = snapshot.skills.find((item) => item.ref === ref);
      if (!skill) return false;
      const tool = normalizeMatchText(parseSkillQualifier(skill.name).tool);
      if (tool.length < 3) return true;
      if (termAppears(work, tool)) return true;
      const evidence = skillEvidence(skill.name, snapshot);
      if (termAppears(asked, tool) && evidence === "hands_on") return true;
      review.push({
        code: "SKILL_EVIDENCE",
        severity: "note",
        ref,
        reason: evidence === "hands_on" ? "irrelevant_skill" : evidence,
      });
      return false;
    });
  }
}

function replaceWeakProject(
  selected: Map<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  snapshot: LibrarySnapshot,
  terms: readonly string[],
): Set<string> {
  const replaced = new Set<string>();
  const library = snapshot.entries.filter((entry) => entry.kind === "PROJECT" && practicedProject(entry));
  const best = [...library].sort(
    (left, right) => jobProjectRank(right, terms) - jobProjectRank(left, terms),
  )[0];
  if (!best) return replaced;
  const current = [...selected.keys()]
    .map((ref) => byRef.get(ref))
    .filter((entry): entry is SnapshotEntry => entry?.kind === "PROJECT");
  if (current.length === 0 || current.some((entry) => entry.ref === best.ref)) return replaced;
  const weakest = [...current].sort((left, right) => jobProjectRank(left, terms) - jobProjectRank(right, terms))[0];
  if (!weakest || jobProjectRank(best, terms) <= jobProjectRank(weakest, terms)) return replaced;
  const bullets = scoreBullets(best, terms)
    .filter((item) => item.handsOn && !item.academic)
    .slice(0, 2);
  if (bullets.length === 0) return replaced;
  selected.delete(weakest.ref);
  replaced.add(weakest.ref);
  selected.set(best.ref, {
    ref: best.ref,
    origin: "prioritized",
    bullets: bullets.map((item) => libraryBullet(item.bullet)),
  });
  return replaced;
}

function jobProjectRank(entry: SnapshotEntry, terms: readonly string[]): number {
  const blob = entryBlob(entry);
  const tools = knownTerms(blob);
  let postingTools = 0;
  for (const term of terms) {
    const needle = normalizeMatchText(term);
    if (needle.length < 3 || !tools.has(needle)) continue;
    postingTools += 1;
  }
  return postingTools * 5 + tools.size + (entry.isCurrent ? 3 : 0);
}

function pruneProjects(
  selected: Map<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  snapshot: LibrarySnapshot,
  musts: readonly string[],
  keywords: readonly string[],
  length: 1 | 2,
  terms: readonly string[],
): Set<string> {
  const dropped = new Set<string>();
  const projects = [...selected.values()]
    .map((row) => byRef.get(row.ref))
    .filter((entry): entry is SnapshotEntry => entry?.kind === "PROJECT")
    .sort((left, right) => jobProjectRank(right, terms) - jobProjectRank(left, terms));
  if (projects.length <= 1) return dropped;
    const kept: SnapshotEntry[] = [];
    let covered = coveredBlob(selected, byRef, "EXPERIENCE");
    for (const project of projects) {
      const extraTerms = length === 1 ? musts : [...musts, ...keywords];
      const practiced = practicedProject(project);
      const earns =
        (kept.length === 0 ||
          addsEvidence(project, covered, extraTerms) ||
          (length === 2 && kept.length < 3 && addsEvidence(project, covered, keywords))) &&
        (practiced || !kept.some(practicedProject));
      if (!earns) {
      selected.delete(project.ref);
      dropped.add(project.ref);
      continue;
    }
    kept.push(project);
    covered = `${covered}\n${entryBlob(project)}`;
  }
  return dropped;
}

function groupAlreadySelected(
  entry: SnapshotEntry,
  selected: ReadonlyMap<string, Working>,
  snapshot: LibrarySnapshot,
  confirmed: readonly (readonly string[])[] = [],
): boolean {
  const members = new Set(groupMembers(snapshot.entries, snapshot.takenAt, entry.ref, confirmed));
  for (const ref of selected.keys()) {
    if (members.has(ref)) return true;
  }
  return false;
}

function countKind(
  selected: ReadonlyMap<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  kind: SnapshotEntry["kind"],
): number {
  let count = 0;
  for (const ref of selected.keys()) {
    if (byRef.get(ref)?.kind === kind) count += 1;
  }
  return count;
}

function coveredBlob(
  selected: ReadonlyMap<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  kind?: SnapshotEntry["kind"],
): string {
  const parts: string[] = [];
  for (const ref of selected.keys()) {
    const entry = byRef.get(ref);
    if (!entry || (kind && entry.kind !== kind)) continue;
    parts.push(entryBlob(entry));
  }
  return parts.join("\n");
}

function entryBlob(entry: SnapshotEntry): string {
  return [entry.title, entry.organization ?? "", ...entry.bullets.map((bullet) => bullet.text)].join(" ");
}

function addsEvidence(entry: SnapshotEntry, covered: string, terms: readonly string[]): boolean {
  return addedTerms(entryBlob(entry), covered, terms).length > 0;
}

function addedTerms(text: string, covered: string, terms: readonly string[]): string[] {
  const haystack = normalizeMatchText(text);
  const already = normalizeMatchText(covered);
  const found: string[] = [];
  for (const term of terms) {
    const needle = normalizeMatchText(term);
    if (needle.length < 3 || !termAppears(haystack, needle) || termAppears(already, needle)) continue;
    found.push(needle);
  }
  return found;
}

function newKnownTool(text: string, covered: string): boolean {
  const present = knownTerms(covered);
  for (const term of knownTerms(text)) {
    if (!present.has(term)) return true;
  }
  return false;
}

function uniqueNumber(text: string, covered: string): boolean {
  const numbers = text.match(/\d+(?:\.\d+)?/g) ?? [];
  return numbers.some((value) => !covered.includes(value));
}

function withGroupBullets(
  entry: SnapshotEntry,
  snapshot: LibrarySnapshot,
  confirmed: readonly (readonly string[])[] = [],
): SnapshotEntry {
  const members = new Set(groupMembers(snapshot.entries, snapshot.takenAt, entry.ref, confirmed));
  if (members.size === 1) return entry;
  const bullets = snapshot.entries
    .filter((item) => members.has(item.ref))
    .flatMap((item) => item.bullets);
  return { ...entry, bullets };
}

function distinctFacts(bullets: readonly ValidatedBullet[]): ValidatedBullet[] {
  const kept: ValidatedBullet[] = [];
  for (const bullet of bullets) {
    const index = kept.findIndex((prior) => sameFact(prior.text, bullet.text));
    if (index === -1) {
      kept.push({ ...bullet, sourceRefs: [...bullet.sourceRefs] });
      continue;
    }
    const prior = kept[index];
    if (!prior) continue;
    const preferIncoming = factTokens(bullet.text).size > factTokens(prior.text).size;
    const chosen = preferIncoming ? bullet : prior;
    kept[index] = {
      ...chosen,
      text: chosen.text,
      sourceRefs: mergeRefs(prior.sourceRefs, bullet.sourceRefs),
    };
  }
  return kept;
}

function sameFact(left: string, right: string): boolean {
  if (sameWording(left, right)) return true;
  if (tokenJaccard(left, right) >= 0.72) return numbersMatch(left, right);
  if (subsumed(left, right) || subsumed(right, left)) return true;
  if (restatesKnownFacts(left, right) || restatesKnownFacts(right, left)) return true;
  return sharedOutcome(left, right);
}

const OUTCOME_STOP = new Set([
  "report",
  "reports",
  "process",
  "system",
  "systems",
  "support",
  "manage",
  "develop",
  "create",
  "build",
  "implement",
  "service",
  "customer",
  "project",
  "experience",
  "business",
  "analysis",
  "information",
]);

/** The same measured result said two ways. A shared number alone does not count. */
function sharedOutcome(left: string, right: string): boolean {
  const numbers = (left.match(/\d+(?:\.\d+)?/g) ?? []).filter((value) => value.length >= 2);
  if (numbers.length === 0 || !numbers.every((value) => right.includes(value))) return false;
  const leftStems = outcomeStems(left);
  const rightStems = outcomeStems(right);
  for (const stem of leftStems) {
    if (rightStems.has(stem)) return true;
  }
  return false;
}

function outcomeStems(text: string): Set<string> {
  const stems = new Set<string>();
  for (const token of normalizeMatchText(text).split(/[^a-z0-9]+/)) {
    if (token.length < 6 || OUTCOME_STOP.has(token)) continue;
    stems.add(token.slice(0, 6));
  }
  return stems;
}

/** The same tools and outcome, with different filler words. A new tool or number stays. */
function restatesKnownFacts(inner: string, outer: string): boolean {
  const innerTerms = knownTerms(inner);
  const outerTerms = knownTerms(outer);
  if (innerTerms.size === 0) return false;
  for (const term of innerTerms) {
    if (!outerTerms.has(term)) return false;
  }
  const innerNumbers = inner.match(/\d+(?:\.\d+)?/g) ?? [];
  return innerNumbers.every((value) => outer.includes(value));
}

function knownTerms(text: string): Set<string> {
  const haystack = normalizeMatchText(text)
    .replace(/\boauth\s*2(?:\.0)?\b/g, "oauth")
    .replace(/\boauth2\b/g, "oauth");
  const found = new Set<string>();
  for (const term of [...KNOWN_TERMS, "oauth", "authentication", "firebase"]) {
    if (term.length < 3 || !termAppears(haystack, term)) continue;
    found.add(term);
  }
  return found;
}

function capPeripheralExperience(
  rows: readonly Working[],
  byRef: ReadonlyMap<string, SnapshotEntry>,
  terms: readonly string[],
): void {
  const ranks = rows
    .map((row) => byRef.get(row.ref))
    .filter((entry): entry is SnapshotEntry => entry?.kind === "EXPERIENCE")
    .map((entry) => jobProjectRank(entry, terms));
  const best = Math.max(0, ...ranks);
  for (const row of rows) {
    const entry = byRef.get(row.ref);
    if (!entry || entry.kind !== "EXPERIENCE" || row.bullets.length <= 2) continue;
    if (jobProjectRank(entry, terms) >= best) continue;
    const ranked = [...row.bullets].sort(
      (left, right) => addedTerms(right.text, "", terms).length - addedTerms(left.text, "", terms).length,
    );
    row.bullets = ranked.slice(0, 2);
  }
}

function practicedProject(entry: SnapshotEntry): boolean {
  return entry.bullets.some(
    (bullet) => practicedLine(bullet.text) && !lineAcademic(entry, bullet.text),
  );
}

function projectStrength(entry: SnapshotEntry, terms: readonly string[], takenAt: string): number {
  return (practicedProject(entry) ? 100 : 0) + entryScore(entry, terms, takenAt);
}

function addPracticedProjectBullets(
  rows: readonly Working[],
  byRef: ReadonlyMap<string, SnapshotEntry>,
  snapshot: LibrarySnapshot,
  terms: readonly string[],
  confirmed: readonly (readonly string[])[] = [],
): void {
  const projects = rows.filter((row) => byRef.get(row.ref)?.kind === "PROJECT");
  const lead = [...projects].sort((left, right) => {
    const leftEntry = byRef.get(left.ref);
    const rightEntry = byRef.get(right.ref);
    if (!leftEntry || !rightEntry) return 0;
    return projectStrength(rightEntry, terms, snapshot.takenAt) - projectStrength(leftEntry, terms, snapshot.takenAt);
  })[0];
  const entry = lead ? byRef.get(lead.ref) : undefined;
  if (!lead || !entry) return;
  const scored = scoreBullets(withGroupBullets(entry, snapshot, confirmed), terms).filter(
    (item) => item.handsOn && !item.academic,
  );
  for (const item of scored) {
    if (lead.bullets.length >= 3) break;
    if (lead.bullets.some((bullet) => bullet.sourceRefs.includes(item.bullet.ref) || sameFact(bullet.text, item.bullet.text))) {
      continue;
    }
    const present = lead.bullets.map((bullet) => bullet.text).join(" ");
    const adds = [...knownTerms(item.bullet.text)].some((term) => !knownTerms(present).has(term));
    if (!adds) continue;
    lead.bullets.unshift(libraryBullet(item.bullet));
  }
}

function numbersMatch(left: string, right: string): boolean {
  const leftNumbers = left.match(/\d+(?:\.\d+)?/g) ?? [];
  const rightNumbers = right.match(/\d+(?:\.\d+)?/g) ?? [];
  return (
    leftNumbers.every((value) => right.includes(value)) &&
    rightNumbers.every((value) => left.includes(value))
  );
}

function mergeRefs(left: readonly string[], right: readonly string[]): string[] {
  const refs = [...left];
  for (const ref of right) {
    if (!refs.includes(ref) && refs.length < 5) refs.push(ref);
  }
  return refs;
}

/** True when every meaningful token of `inner` already appears in `outer`. */
function subsumed(outer: string, inner: string): boolean {
  const outerTokens = factTokens(outer);
  const innerTokens = factTokens(inner);
  if (innerTokens.size < 4 || innerTokens.size > outerTokens.size) return false;
  for (const token of innerTokens) {
    if (!outerTokens.has(token)) return false;
  }
  const innerNumbers = inner.match(/\d+(?:\.\d+)?/g) ?? [];
  return innerNumbers.every((value) => outer.includes(value));
}

function tokenJaccard(left: string, right: string): number {
  const a = factTokens(left);
  const b = factTokens(right);
  if (a.size < 4 || b.size < 4) return 0;
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) shared += 1;
  }
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

function factTokens(text: string): Set<string> {
  return new Set(
    normalizeMatchText(text)
      .split(" ")
      .filter((token) => token.length > 2 && !TERM_STOP.has(token)),
  );
}

function mustHaveTerms(analysis: JobAnalysis): string[] {
  const terms: string[] = [];
  for (const requirement of analysis.requirements) {
    if (requirement.importance !== "must") continue;
    terms.push(...requirementTerms(requirement, analysis.keywords));
  }
  return [...new Set(terms.map((term) => term.trim()).filter((term) => term.length >= 3))];
}

function dropEmpty(
  selected: Map<string, Working>,
  byRef: ReadonlyMap<string, SnapshotEntry>,
): Set<string> {
  const dropped = new Set<string>();
  for (const [ref, row] of selected) {
    if (row.bullets.length > 0) continue;
    if (byRef.get(ref)?.kind === "EDUCATION") continue;
    selected.delete(ref);
    dropped.add(ref);
  }
  return dropped;
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
  musts: readonly string[],
  review: ResumeReviewItem[],
  keepOrder = false,
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

  preferRicherClaims(entry, chosen, used, terms, musts, bySource, review);

  if (!keepOrder) chosen.sort((left, right) => right.score - left.score);
  return chosen.map((item) => item.bullet);
}

/**
 * On one role, a thin line that repeats a more specific line is left off the
 * resume. The library bullet stays. A line that is the only evidence for a
 * requirement stays even when it overlaps. A combined line is unpacked when
 * one of its sources has a more specific supported claim.
 */
function richerClaim(
  source: SnapshotBullet,
  library: readonly SnapshotBullet[],
  terms: readonly string[],
  musts: readonly string[],
): SnapshotBullet | null {
  let best: SnapshotBullet | null = null;
  for (const candidate of library) {
    if (candidate.ref === source.ref) continue;
    if (coversExtraMust(source.text, candidate.text, musts)) continue;
    if (!dominates(candidate.text, source.text, terms)) continue;
    if (!best || evidenceSubstance(candidate.text) > evidenceSubstance(best.text)) best = candidate;
  }
  return best;
}

function preferRicherClaims(
  entry: SnapshotEntry,
  chosen: { bullet: ValidatedBullet; score: number }[],
  used: Set<string>,
  terms: readonly string[],
  musts: readonly string[],
  bySource: ReadonlyMap<string, ScoredBullet>,
  review: ResumeReviewItem[],
): void {
  const library = entry.bullets;
  let guard = 0;
  while (guard < library.length + 1) {
    guard += 1;
    let changed = false;
    for (let index = 0; index < chosen.length; index += 1) {
      const current = chosen[index];
      if (!current || current.bullet.sourceRefs.length === 0) continue;
      if (current.bullet.sourceRefs.length > 1) {
        const pieces: SnapshotBullet[] = [];
        const replaced: string[] = [];
        for (const ref of current.bullet.sourceRefs) {
          const source = library.find((bullet) => bullet.ref === ref);
          if (!source) continue;
          const better = richerClaim(source, library, terms, musts);
          if (!better || current.bullet.sourceRefs.includes(better.ref)) {
            pieces.push(source);
            continue;
          }
          replaced.push(ref);
          if (!pieces.some((piece) => piece.ref === better.ref)) pieces.push(better);
        }
        if (replaced.length === 0) continue;
        const fresh = pieces.filter(
          (piece) =>
            !chosen.some(
              (item, itemIndex) =>
                itemIndex !== index &&
                item.bullet.sourceRefs.length === 1 &&
                item.bullet.sourceRefs[0] === piece.ref,
            ),
        );
        if (fresh.length === 0) chosen.splice(index, 1);
        else {
          chosen.splice(
            index,
            1,
            ...fresh.map((piece) => ({
              bullet: libraryBullet(piece),
              score: bySource.get(piece.ref)?.score ?? evidenceSubstance(piece.text),
            })),
          );
          for (const piece of fresh) used.add(piece.ref);
        }
        for (const ref of replaced) {
          review.push({
            code: "BULLET_PREFERENCE",
            severity: "note",
            ref,
            reason: "overlapping_claim",
          });
        }
        changed = true;
        break;
      }
      const ref = current.bullet.sourceRefs[0];
      if (!ref) continue;
      const source = library.find((bullet) => bullet.ref === ref);
      if (!source) continue;
      let best: SnapshotBullet | null = richerClaim(source, library, terms, musts);
      for (const candidate of library) {
        if (candidate.ref === ref || coversExtraMust(source.text, candidate.text, musts)) continue;
        if (!dominates(candidate.text, current.bullet.text, terms)) continue;
        if (!best || evidenceSubstance(candidate.text) > evidenceSubstance(best.text)) best = candidate;
      }
      if (!best) continue;
      const already = chosen.some(
        (item) => item.bullet.sourceRefs.length === 1 && item.bullet.sourceRefs[0] === best.ref,
      );
      if (already) {
        chosen.splice(index, 1);
        review.push({
          code: "BULLET_PREFERENCE",
          severity: "note",
          ref,
          reason: "overlapping_claim",
        });
        changed = true;
        break;
      }
      if (used.has(best.ref)) continue;
      used.add(best.ref);
      chosen[index] = {
        bullet: libraryBullet(best),
        score: bySource.get(best.ref)?.score ?? evidenceSubstance(best.text),
      };
      review.push({
        code: "BULLET_PREFERENCE",
        severity: "note",
        ref,
        reason: "overlapping_claim",
      });
      changed = true;
      break;
    }
    if (!changed) break;
  }
}

const LINE_BUDGET = { 1: 40, 2: 84 } as const;

function trimBudget(
  rows: readonly Working[],
  byRef: ReadonlyMap<string, SnapshotEntry>,
  terms: readonly string[],
  snapshot: LibrarySnapshot,
  length: 1 | 2,
  musts: readonly string[],
  review: ResumeReviewItem[],
  weights?: ReadonlyMap<string, number>,
): void {
  const budget = BULLET_BUDGET[length];
  const lineBudget = LINE_BUDGET[length];
  const ranked = rows.map((row) => {
    const entry = byRef.get(row.ref);
    return {
      row,
      relevance: entry ? entryScore(entry, terms, snapshot.takenAt) : 0,
      scores: scoreMap(entry ? withGroupBullets(entry, snapshot) : undefined, terms),
    };
  });
  const total = () => ranked.reduce((sum, item) => sum + item.row.bullets.length, 0);
  const strongestWeight = Math.max(0, ...ranked.map((item) => weights?.get(item.row.ref) ?? 0));
  const lowerWeight = (ref: string) => weights !== undefined && (weights.get(ref) ?? 0) < strongestWeight;
  const dropOne = (strongOnly: boolean, reason = "space"): boolean => {
    const candidates = ranked
      .flatMap((item) =>
        item.row.bullets.map((bullet, index) => ({
          item,
          index,
          score: bulletScore(bullet, item.scores),
        })),
      )
      .filter((candidate) => candidate.item.row.bullets.length > 1 || lowerWeight(candidate.item.row.ref))
      .filter((candidate) => (strongOnly ? candidate.score >= STRONG_SCORE : candidate.score < STRONG_SCORE))
      .sort(
        (left, right) =>
          (weights?.get(left.item.row.ref) ?? 0) - (weights?.get(right.item.row.ref) ?? 0) ||
          left.score - right.score ||
          left.item.relevance - right.item.relevance,
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
      const remaining = ranked.flatMap((item) => item.row.bullets.map((bullet) => bullet.text)).join(" ");
      const critical =
        removed !== undefined &&
        musts.some((term) => {
          const needle = normalizeMatchText(term);
          return (
            needle.length >= 3 &&
            termAppears(removed.text, needle) &&
            !termAppears(remaining, needle)
          );
        });
      review.push({
        code: "BULLET_PREFERENCE",
        severity: critical ? "warning" : "note",
        ref,
        reason,
      });
    }
    return true;
  };
  const dropExtraProject = (): boolean => {
    const projects = ranked.filter(
      (item) => byRef.get(item.row.ref)?.kind === "PROJECT" && item.row.bullets.length > 0,
    );
    if (projects.length <= 1) return false;
    const weakest = [...projects].sort(
      (left, right) =>
        (weights?.get(left.row.ref) ?? 0) - (weights?.get(right.row.ref) ?? 0) ||
        left.relevance - right.relevance,
    )[0];
    if (!weakest) return false;
    weakest.row.bullets = [];
    return true;
  };
  const dropLowerWeightProject = (): boolean => {
    if (!weights || weights.size === 0) return false;
    const projects = ranked.filter(
      (item) => byRef.get(item.row.ref)?.kind === "PROJECT" && item.row.bullets.length > 0,
    );
    if (projects.length <= 1) return false;
    const strongest = Math.max(...ranked.map((item) => weights.get(item.row.ref) ?? 0));
    const weakest = [...projects].sort(
      (left, right) => (weights.get(left.row.ref) ?? 0) - (weights.get(right.row.ref) ?? 0),
    )[0];
    if (!weakest || (weights.get(weakest.row.ref) ?? 0) >= strongest) return false;
    weakest.row.bullets = [];
    return true;
  };
  let guard = 0;
  while (total() > budget && guard < 40) {
    if (!dropOne(false) && !dropOne(true)) break;
    guard += 1;
  }
  while (estimatedLines(ranked) > lineBudget && guard < 80) {
    if (dropLowerWeightProject()) {
      guard += 1;
      continue;
    }
    if (!dropOne(false, "page_budget") && !dropOne(true, "page_budget") && !dropExtraProject()) break;
    guard += 1;
  }
}

function estimatedLines(rows: readonly { row: Working }[]): number {
  let lines = 10;
  for (const item of rows) {
    if (item.row.bullets.length === 0) continue;
    lines += 3;
    for (const bullet of item.row.bullets) {
      lines += Math.max(1, Math.ceil(bullet.text.length / 88));
    }
  }
  return lines;
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
  const parsed = parseSkillQualifier(name);
  const needle = normalizeMatchText(parsed.tool);
  let academic = false;
  let handsOn = false;
  for (const entry of snapshot.entries) {
    for (const bullet of entry.bullets) {
      if (!termAppears(normalizeMatchText(bullet.text), needle)) continue;
      const course = lineAcademic(entry, bullet.text) || UNFINISHED.test(bullet.text);
      const practice = practicedLine(bullet.text) && !lineAcademic(entry, bullet.text);
      if (practice) handsOn = true;
      else if (course) academic = true;
    }
  }
  if (handsOn) return "hands_on";
  if (academic || parsed.qualifier === "coursework") return "academic";
  return "name_only";
}

function libraryBullet(bullet: SnapshotBullet): ValidatedBullet {
  return { sourceRefs: [bullet.ref], text: bullet.text, reverted: false };
}

function scoreBullets(entry: SnapshotEntry, terms: readonly string[]): ScoredBullet[] {
  return entry.bullets
    .map((bullet) => {
      const academic = lineAcademic(entry, bullet.text);
      const handsOn = practicedLine(bullet.text) && !academic;
      const generic = GENERIC.test(bullet.text) && !handsOn;
      const unfinished = UNFINISHED.test(bullet.text);
      let score = 0;
      if (handsOn) score += 3;
      if (generic) score -= 3;
      if (academic) score -= 2;
      if (unfinished) score -= 1;
      score += overlap(bullet.text, terms) * 2;
      if (!academic) score += Math.min(evidenceSubstance(bullet.text), 3);
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

function lineAcademic(entry: { kind: string; title: string }, text: string): boolean {
  return entry.kind === "EDUCATION" || ACADEMIC.test(text) || ACADEMIC.test(entry.title);
}

/** Doing the work, including a GIS line that names the tool without a software verb. */
function practicedLine(text: string): boolean {
  if (GENERIC.test(text)) return false;
  if (HANDS_ON.test(text)) return true;
  return hasKnownTerm(text);
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
    entry.bullets.length > 0 && entry.bullets.every((bullet) => lineAcademic(entry, bullet.text))
      ? 1
      : 0;
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
