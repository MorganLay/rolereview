/**
 * Fabrication guard for a tailored resume.
 * docs/05-AI.md → The fabrication guard.
 * Pure: G1–G20 clean the model output before anything is saved.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { hasUnsupportedNumber } from "@/lib/ai/numbers";

import {
  citedExperienceYears,
  evidenceText,
  inflatedRole,
  isRedundantBullet,
  raisedProficiency,
  summaryProficiency,
  requirementOverstated,
  sameWording,
  unsupportedClaim,
} from "./grounding";
import { chooseEducationKeepers } from "./identity";
import { experienceGroups, type ExperienceGroup } from "./stints";
import { NOT_ASSESSED_NOTE, RESUME_LIMITS } from "./schemas";
import type {
  EditorialPlan,
  GuardRequirementMatch,
  RequirementMatch,
  TailorBullet,
  TailorOutput,
  TailorSkillGroup,
  ValidatedBullet,
  ValidatedTailorOutput,
} from "./schemas";
import {
  hasOverstatedTenure,
  libraryNumberSources,
  snapshotTenure,
  stripEducationDurationPhrases,
} from "./tenure";

export const GUARD_CODES = [
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "G10",
  "G11",
  "G12",
  "G13",
  "G14",
  "G15",
  "G16",
  "G17",
  "G18",
  "G19",
  "G20",
] as const;

export type GuardCode = (typeof GUARD_CODES)[number];

/** A code and a ref id. Never bullet text or posting text. */
export type GuardIssue = {
  code: GuardCode;
  ref: string;
};

export type GuardResult = {
  output: ValidatedTailorOutput;
  reverts: number;
  issues: GuardIssue[];
};

export function validateTailorOutput(
  output: TailorOutput,
  snapshot: LibrarySnapshot,
  analysis: JobAnalysis,
  confirmed: readonly (readonly string[])[] = [],
): GuardResult {
  const issues: GuardIssue[] = [];
  const entries = dropRedundant(
    cleanEntries(output.entries, snapshot, issues, confirmed),
    issues,
  );
  const skills = cleanSkills(output.skills, snapshot, issues);
  const requirementMatches = cleanMatches(
    output.requirementMatches,
    analysis,
    snapshot,
    issues,
  );
  const summary = cleanSummary(output.summary, snapshot, issues);
  const plan = clipPlan(output.plan, analysis);
  return {
    output: {
      summary: summary.text,
      ...(plan ? { plan } : {}),
      entries: entries.entries,
      skills,
      requirementMatches,
    },
    reverts: entries.reverts + summary.reverts,
    issues,
  };
}

function clipPlan(
  plan: EditorialPlan | undefined,
  analysis: JobAnalysis,
): EditorialPlan | undefined {
  if (!plan) return undefined;
  const narrative = clip(plan.narrative, 400);
  const priorities = plan.priorities
    .map((item) => clip(item.trim(), 120))
    .filter((item) => item.length > 0)
    .slice(0, 4);
  const gaps = plan.gaps
    .map((item) => gapLabel(item, analysis))
    .filter((item) => item.length > 0)
    .slice(0, 8);
  const hiringFor = clip(plan.hiringFor ?? "", 200);
  const positioning = clip(plan.positioning ?? "", 240);
  const qualifications = (plan.qualifications ?? [])
    .map((item) => ({
      requirementId: clip(item.requirementId.trim(), 40),
      weight: item.weight,
    }))
    .filter((item) => item.requirementId.length > 0)
    .slice(0, 12);
  const evidence = (plan.evidence ?? [])
    .map((item) => ({
      ref: clip(item.ref.trim(), 40),
      use: item.use,
      bullets: Math.max(0, Math.min(6, Math.round(item.bullets))),
      because: clip(item.because.trim(), 240),
    }))
    .filter((item) => item.ref.length > 0)
    .slice(0, 12);
  if (
    narrative.length === 0 &&
    priorities.length === 0 &&
    gaps.length === 0 &&
    hiringFor.length === 0 &&
    positioning.length === 0 &&
    qualifications.length === 0 &&
    evidence.length === 0
  ) {
    return undefined;
  }
  return {
    narrative,
    priorities,
    gaps,
    ...(hiringFor.length > 0 ? { hiringFor } : {}),
    ...(positioning.length > 0 ? { positioning } : {}),
    ...(qualifications.length > 0 ? { qualifications } : {}),
    ...(evidence.length > 0 ? { evidence } : {}),
    ...(plan.closeCall === true ? { closeCall: true } : {}),
    ...(clip(plan.headline ?? "", 120).length > 0 ? { headline: clip(plan.headline ?? "", 120) } : {}),
  };
}

/** A gap stored as "r2" is shown as that requirement's text. An unknown id is dropped. */
function gapLabel(value: string, analysis: JobAnalysis): string {
  const trimmed = value.trim();
  if (/^r\d+$/i.test(trimmed)) {
    const text =
      analysis.requirements.find((item) => item.id.toLowerCase() === trimmed.toLowerCase())
        ?.text ?? "";
    return clip(text, 80);
  }
  return clip(trimmed, 80);
}

/**
 * A summary may combine roles. Each tool, proficiency, responsibility, and
 * result still has to appear in the library. A skill name is not proficiency.
 */
function summaryClaimUnsupported(
  sentence: string,
  presence: readonly string[],
  bullets: readonly string[],
): boolean {
  if (presence.length > 0 && unsupportedClaim(sentence, presence) !== null) return true;
  if (bullets.length > 0 && inflatedRole(sentence, bullets) !== null) return true;
  return summaryProficiency(sentence, bullets) !== null;
}

function libraryPresence(snapshot: LibrarySnapshot): string[] {
  const parts: string[] = [];
  if (snapshot.profile.headline) parts.push(snapshot.profile.headline);
  if (snapshot.profile.summary) parts.push(snapshot.profile.summary);
  for (const entry of snapshot.entries) {
    if (entry.title.trim().length > 0) parts.push(entry.title);
    if (entry.organization) parts.push(entry.organization);
    for (const bullet of entry.bullets) parts.push(bullet.text);
  }
  for (const skill of snapshot.skills) parts.push(skill.name);
  return parts;
}

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function cleanSummary(
  text: string,
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): { text: string; reverts: number } {
  const tenure = snapshotTenure(snapshot);
  const sources = libraryNumberSources(snapshot, tenure);
  const presence = libraryPresence(snapshot);
  const bullets = snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
  const parts = sentences(text);
  if (parts.length === 0) return { text, reverts: 0 };

  const kept: string[] = [];
  let dropped = false;
  for (const sentence of parts) {
    const forNumbers = stripEducationDurationPhrases(sentence);
    if (
      hasOverstatedTenure(sentence, tenure) ||
      hasUnsupportedNumber(forNumbers, sources) ||
      summaryClaimUnsupported(sentence, presence, bullets)
    ) {
      dropped = true;
      continue;
    }
    kept.push(sentence);
  }

  if (!dropped) return { text, reverts: 0 };
  issues.push({ code: "G12", ref: "summary" });
  const fragment = kept.length === 1 && /^(also|and|additionally)\b/i.test(kept[0]?.trim() ?? "");
  if (kept.length > 0 && !fragment) return { text: kept.join(" "), reverts: 1 };
  return { text: snapshot.profile.summary?.trim() ?? "", reverts: 1 };
}

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

function cleanEntries(
  entries: TailorOutput["entries"],
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
  confirmed: readonly (readonly string[])[] = [],
): { entries: ValidatedTailorOutput["entries"]; reverts: number } {
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  const groups = experienceGroups(snapshot.entries, snapshot.takenAt, confirmed);
  const seen = new Set<string>();
  const cleaned: ValidatedTailorOutput["entries"] = [];
  let reverts = 0;

  for (const entry of entries) {
    const snapshotEntry = byRef.get(entry.ref);
    if (!snapshotEntry) {
      issues.push({ code: "G1", ref: entry.ref });
      continue;
    }
    if (seen.has(entry.ref)) {
      issues.push({ code: "G2", ref: entry.ref });
      continue;
    }
    seen.add(entry.ref);
    const bullets = cleanBullets(entry.bullets, sourcesFor(entry.ref, snapshot, groups), issues);
    reverts += bullets.reverts;
    cleaned.push({ ref: entry.ref, bullets: bullets.bullets });
  }

  return { entries: consolidateEducation(cleaned, snapshot, issues), reverts };
}

/**
 * One row per degree. A second record of the same credential is G18, not a second G11.
 * A distinct omitted degree is still appended with no bullets.
 */
function consolidateEducation(
  entries: ValidatedTailorOutput["entries"],
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): ValidatedTailorOutput["entries"] {
  const counts = new Map(entries.map((entry) => [entry.ref, entry.bullets.length]));
  const decision = chooseEducationKeepers(snapshot.entries, counts);
  const drop = new Set(decision.drop.map((item) => item.ref));
  const kept = entries.filter((entry) => {
    if (!drop.has(entry.ref)) return true;
    issues.push({ code: "G18", ref: entry.ref });
    return false;
  });
  const present = new Set(kept.map((entry) => entry.ref));
  for (const ref of decision.keep) {
    if (present.has(ref)) continue;
    kept.push({ ref, bullets: [] });
    issues.push({ code: "G11", ref });
  }
  return kept;
}

function dropRedundant(
  cleaned: { entries: ValidatedTailorOutput["entries"]; reverts: number },
  issues: GuardIssue[],
): { entries: ValidatedTailorOutput["entries"]; reverts: number } {
  const keptText: string[] = [];
  const entries = cleaned.entries.map((entry) => {
    const bullets: ValidatedBullet[] = [];
    for (const bullet of entry.bullets) {
      if (keptText.some((earlier) => isRedundantBullet(earlier, bullet.text))) {
        const ref = bullet.sourceRefs[0];
        if (ref) issues.push({ code: "G14", ref });
        continue;
      }
      keptText.push(bullet.text);
      bullets.push(bullet);
    }
    return { ref: entry.ref, bullets };
  });
  return { entries, reverts: cleaned.reverts };
}

/** A composed line may cite this many bullets from the same entry. */
const MAX_SOURCES = 5;
/** One source may be split into this many lines. */
const MAX_SPLITS = 2;

function sourcesFor(
  entryRef: string,
  snapshot: LibrarySnapshot,
  groups: readonly ExperienceGroup[],
): Map<string, string> {
  const group = groups.find((item) => item.members.includes(entryRef));
  const members = new Set(group?.members ?? [entryRef]);
  const sources = new Map<string, string>();
  for (const entry of snapshot.entries) {
    if (!members.has(entry.ref)) continue;
    for (const bullet of entry.bullets) sources.set(bullet.ref, bullet.text);
  }
  return sources;
}

function cleanBullets(
  bullets: readonly TailorBullet[],
  owned: ReadonlyMap<string, string>,
  issues: GuardIssue[],
): { bullets: ValidatedBullet[]; reverts: number } {
  const pending: ValidatedBullet[] = [];
  const seenMulti = new Set<string>();
  const singles = new Map<string, string[]>();
  let reverts = 0;

  const rememberSingle = (ref: string, text: string): boolean => {
    const prior = singles.get(ref) ?? [];
    if (prior.length >= MAX_SPLITS || prior.some((item) => sameWording(item, text))) {
      return false;
    }
    prior.push(text);
    singles.set(ref, prior);
    return true;
  };

  for (const bullet of bullets) {
    const sources: { ref: string; text: string }[] = [];
    for (const ref of bullet.sourceRefs) {
      const sourceText = owned.get(ref);
      if (sourceText === undefined) {
        issues.push({ code: "G3", ref });
        continue;
      }
      if (sources.some((source) => source.ref === ref)) continue;
      sources.push({ ref, text: sourceText });
    }

    const first = sources[0];
    if (first === undefined) continue;

    if (sources.length > MAX_SOURCES) {
      issues.push({ code: "G17", ref: first.ref });
      continue;
    }

    const cited = sources.map((source) => source.text);
    let text = bullet.text;
    let reverted = false;
    let code: GuardCode | null = null;
    if (hasUnsupportedNumber(text, cited)) code = "G4";
    else if (text.trim().length === 0 || text.length > RESUME_LIMITS.bullet) code = "G5";
    else {
      const claim = unsupportedClaim(text, cited);
      const inflated =
        claim === null ? inflatedRole(text, cited) ?? raisedProficiency(text, cited) : null;
      if (claim !== null) code = "G13";
      else if (inflated !== null) code = "G16";
    }

    if (code !== null && sources.length > 1) {
      reverts += 1;
      issues.push({ code, ref: first.ref });
      for (const source of sources) {
        if (!rememberSingle(source.ref, source.text)) {
          issues.push({ code: "G6", ref: source.ref });
          continue;
        }
        pending.push({ sourceRefs: [source.ref], text: source.text, reverted: true });
      }
      continue;
    }

    if (code !== null) {
      text = first.text;
      reverted = true;
      reverts += 1;
      issues.push({ code, ref: first.ref });
    }

    if (sources.length > 1) {
      const key = sources
        .map((source) => source.ref)
        .sort()
        .join("\0");
      if (seenMulti.has(key)) {
        issues.push({ code: "G6", ref: first.ref });
        continue;
      }
      seenMulti.add(key);
    } else if (!rememberSingle(first.ref, text)) {
      issues.push({ code: "G6", ref: first.ref });
      continue;
    }

    pending.push({
      sourceRefs: sources.map((source) => source.ref),
      text,
      reverted,
    });
  }

  const covered = new Set<string>();
  for (const bullet of pending) {
    if (bullet.sourceRefs.length < 2 || bullet.reverted) continue;
    for (const ref of bullet.sourceRefs) covered.add(ref);
  }
  const kept: ValidatedBullet[] = [];
  for (const bullet of pending) {
    const only = bullet.sourceRefs.length === 1 ? bullet.sourceRefs[0] : undefined;
    if (only && covered.has(only)) {
      issues.push({ code: "G19", ref: only });
      continue;
    }
    kept.push(bullet);
  }

  return { bullets: kept, reverts };
}

function cleanSkills(
  groups: readonly TailorSkillGroup[],
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): TailorSkillGroup[] {
  const known = new Set(snapshot.skills.map((skill) => skill.ref));
  const cleaned: TailorSkillGroup[] = [];

  for (const group of groups) {
    const refs: string[] = [];
    for (const ref of group.refs) {
      if (!known.has(ref)) {
        issues.push({ code: "G7", ref });
        continue;
      }
      refs.push(ref);
    }
    if (refs.length === 0) continue;
    cleaned.push({ category: group.category, refs });
  }

  return cleaned;
}

function cleanMatches(
  matches: readonly RequirementMatch[],
  analysis: JobAnalysis,
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): GuardRequirementMatch[] {
  const requirementIds = new Set(
    analysis.requirements.map((requirement) => requirement.id),
  );
  const seen = new Set<string>();
  const cleaned: GuardRequirementMatch[] = [];

  for (const match of matches) {
    if (!requirementIds.has(match.requirementId) || seen.has(match.requirementId)) {
      issues.push({ code: "G8", ref: match.requirementId });
      continue;
    }
    seen.add(match.requirementId);
    const requirement =
      analysis.requirements.find((item) => item.id === match.requirementId)?.text ??
      null;
    cleaned.push(cleanEvidence(match, requirement, snapshot, issues));
  }

  for (const requirement of analysis.requirements) {
    if (seen.has(requirement.id)) continue;
    cleaned.push({
      requirementId: requirement.id,
      verdict: "unassessed",
      evidenceRefs: [],
      note: NOT_ASSESSED_NOTE,
    });
    issues.push({ code: "G9", ref: requirement.id });
  }

  return cleaned;
}

function cleanEvidence(
  match: RequirementMatch,
  requirement: string | null,
  snapshot: LibrarySnapshot,
  issues: GuardIssue[],
): RequirementMatch {
  const known = knownRefs(snapshot);
  const evidenceRefs: string[] = [];
  for (const ref of match.evidenceRefs) {
    if (!known.has(ref)) {
      issues.push({ code: "G10", ref });
      continue;
    }
    evidenceRefs.push(ref);
  }

  const unsupported =
    (match.verdict === "met" || match.verdict === "partial") &&
    evidenceRefs.length === 0;
  if (unsupported && match.evidenceRefs.length === 0) {
    issues.push({ code: "G10", ref: match.requirementId });
  }

  const verdict = unsupported ? "missing" : match.verdict;
  const overstated =
    verdict === "met" &&
    requirement !== null &&
    requirementOverstated({
      requirement,
      evidence: evidenceText(evidenceRefs, snapshot),
      yearsAvailable: citedExperienceYears(evidenceRefs, snapshot),
    });
  if (overstated) issues.push({ code: "G15", ref: match.requirementId });

  const skillOnly =
    !overstated &&
    verdict === "met" &&
    evidenceRefs.length > 0 &&
    evidenceRefs.every((ref) => skillRefs(snapshot).has(ref)) &&
    requirement !== null &&
    asksForDepth(requirement);
  if (skillOnly) issues.push({ code: "G20", ref: match.requirementId });

  return {
    requirementId: match.requirementId,
    verdict: overstated || skillOnly ? "partial" : verdict,
    evidenceRefs,
    note: overstated
      ? "Related experience is on file. It does not show this requirement in full."
      : skillOnly
        ? "Declared as a skill. The library does not show this as experience."
        : match.note,
  };
}

function skillRefs(snapshot: LibrarySnapshot): Set<string> {
  return new Set(snapshot.skills.map((skill) => skill.ref));
}

function asksForDepth(requirement: string): boolean {
  return /\b(years|professional|proficient|production|experience)\b/i.test(requirement);
}

function knownRefs(snapshot: LibrarySnapshot): Set<string> {
  const refs = new Set<string>();
  for (const entry of snapshot.entries) {
    refs.add(entry.ref);
    for (const bullet of entry.bullets) refs.add(bullet.ref);
  }
  for (const skill of snapshot.skills) refs.add(skill.ref);
  return refs;
}
