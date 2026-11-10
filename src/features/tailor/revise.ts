/**
 * One revision pass when the draft leaves strong library evidence off the page.
 * A draft that already shows that evidence does not need another model call.
 */

import type { JobAnalysis } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";

import { requirementCoverage, requirementTerms } from "./coverage";
import { sameWording } from "./grounding";
import { normalizeMatchText, termAppears } from "./keywords";
import type { BulletNote } from "./variants";
import type { TailorOutput, ValidatedBullet, ValidatedTailorOutput } from "./schemas";

const MAX_ENTRIES = 3;
const MAX_SOURCES = 6;

export type RevisionSource = {
  ref: string;
  text: string;
};

export type RevisionTarget = {
  entryRef: string;
  reason: "omitted_evidence" | "undersold" | "underspecified";
  requirementIds: string[];
  unused: RevisionSource[];
  current: { sourceRefs: string[]; text: string }[];
};

export type RevisionEntry = {
  ref: string;
  bullets: readonly {
    sourceRefs: readonly string[];
    text: string;
    what: string;
    why: string;
    requirementIds: readonly string[];
  }[];
};

type SnapshotEntry = LibrarySnapshot["entries"][number];

export function revisionTargets(input: {
  output: ValidatedTailorOutput;
  snapshot: LibrarySnapshot;
  analysis: JobAnalysis;
}): RevisionTarget[] {
  const byRef = new Map(input.snapshot.entries.map((entry) => [entry.ref, entry]));
  const cited = citedRefs(input.output);
  const targets = new Map<string, RevisionTarget>();
  const coverage = requirementCoverage(input);

  for (const row of coverage) {
    if (row.library !== "direct" || row.presented === "on_resume") continue;
    const requirement = input.analysis.requirements.find((item) => item.id === row.requirementId);
    if (!requirement || requirement.importance !== "must") continue;
    for (const ref of row.sourceRefs) {
      if (cited.has(ref)) continue;
      const located = locate(ref, input.snapshot);
      if (!located || located.entry.kind === "EDUCATION") continue;
      addSource(targets, located.entry.ref, "omitted_evidence", requirement.id, {
        ref,
        text: located.text,
      });
    }
  }

  addUnderspecified(targets, input.output, byRef, input.analysis);

  const undersold = undersoldEntry(input.output, byRef, cited);
  if (undersold) {
    for (const bullet of undersold.entry.bullets) {
      if (cited.has(bullet.ref)) continue;
      if (!/\b(built|implemented|developed|tested|integrated|deployed|debugged)\b/i.test(bullet.text)) {
        continue;
      }
      addSource(targets, undersold.entry.ref, "undersold", "", {
        ref: bullet.ref,
        text: bullet.text,
      });
    }
  }

  return [...targets.values()]
    .filter((target) => target.unused.length > 0)
    .slice(0, MAX_ENTRIES)
    .map((target) => ({
      ...target,
      requirementIds: target.requirementIds.filter((id) => id.length > 0).slice(0, 4),
      unused: target.unused.slice(0, 4),
      current: currentBullets(input.output, target.entryRef),
    }));
}

export function allowedRefs(target: RevisionTarget): Set<string> {
  const refs = new Set(target.unused.map((source) => source.ref));
  for (const bullet of target.current) {
    for (const ref of bullet.sourceRefs) refs.add(ref);
  }
  return refs;
}

export function mergeRevision(
  output: ValidatedTailorOutput,
  entries: readonly RevisionEntry[],
  targets: readonly RevisionTarget[],
): { output: TailorOutput; notes: Map<string, BulletNote> } {
  const revised = new Map(entries.map((entry) => [entry.ref, entry]));
  const notes = new Map<string, BulletNote>();
  const next = asTailor(output).entries.map((entry) => {
    const target = targets.find((item) => item.entryRef === entry.ref);
    const replacement = revised.get(entry.ref);
    if (!target || !replacement) return entry;
    const allowed = allowedRefs(target);
    const bullets: TailorOutput["entries"][number]["bullets"] = [];
    for (const bullet of replacement.bullets) {
      const refs = unique(bullet.sourceRefs);
      if (refs.length === 0 || refs.some((ref) => !allowed.has(ref))) continue;
      const text = bullet.text.trim();
      if (text.length === 0) continue;
      bullets.push({ sourceRefs: refs, text: bullet.text });
      const what = clip(bullet.what);
      const why = clip(bullet.why);
      if (what.length === 0 && why.length === 0 && bullet.requirementIds.length === 0) continue;
      notes.set(sourceKey(refs), {
        what,
        why,
        requirementIds: bullet.requirementIds.map((id) => id.trim()).filter((id) => id.length > 0).slice(0, 8),
      });
    }
    if (bullets.length === 0) return entry;
    return { ...entry, bullets };
  });
  for (const target of targets) {
    if (next.some((entry) => entry.ref === target.entryRef)) continue;
    const replacement = revised.get(target.entryRef);
    if (!replacement) continue;
    const allowed = allowedRefs(target);
    const bullets: TailorOutput["entries"][number]["bullets"] = [];
    for (const bullet of replacement.bullets) {
      const refs = unique(bullet.sourceRefs);
      if (refs.length === 0 || refs.some((ref) => !allowed.has(ref))) continue;
      if (bullet.text.trim().length === 0) continue;
      bullets.push({ sourceRefs: refs, text: bullet.text });
      notes.set(sourceKey(refs), {
        what: clip(bullet.what),
        why: clip(bullet.why),
        requirementIds: bullet.requirementIds
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
          .slice(0, 8),
      });
    }
    if (bullets.length === 0) continue;
    next.push({ ref: target.entryRef, bullets });
  }
  return { output: { ...asTailor(output), entries: next }, notes };
}

function asTailor(output: ValidatedTailorOutput): TailorOutput {
  return {
    summary: output.summary,
    ...(output.plan ? { plan: output.plan } : {}),
    entries: output.entries.map((entry) => ({
      ref: entry.ref,
      bullets: entry.bullets.map((bullet) => ({
        sourceRefs: [...bullet.sourceRefs],
        text: bullet.text,
      })),
    })),
    skills: output.skills.map((group) => ({
      category: group.category,
      refs: [...group.refs],
    })),
    requirementMatches: output.requirementMatches.map((match) => ({
      requirementId: match.requirementId,
      verdict: match.verdict === "unassessed" ? "missing" : match.verdict,
      evidenceRefs: [...match.evidenceRefs],
      note: match.note,
    })),
  };
}

/**
 * Keep a revised entry only when every replacement line passed the guard.
 * Other entries stay as they were.
 */
export function acceptRevision(
  first: ValidatedTailorOutput,
  second: ValidatedTailorOutput,
  entryRefs: readonly string[],
): { output: ValidatedTailorOutput; accepted: string[] } {
  const wanted = new Set(entryRefs);
  const accepted: string[] = [];
  const entries = first.entries.map((entry) => {
    if (!wanted.has(entry.ref)) return entry;
    const revised = second.entries.find((item) => item.ref === entry.ref);
    if (!revised || revised.bullets.length === 0) return entry;
    if (revised.bullets.some((bullet) => bullet.reverted)) return entry;
    if (sameBullets(entry.bullets, revised.bullets)) return entry;
    accepted.push(entry.ref);
    return revised;
  });
  for (const ref of wanted) {
    if (entries.some((entry) => entry.ref === ref)) continue;
    const revised = second.entries.find((item) => item.ref === ref);
    if (!revised || revised.bullets.length === 0) continue;
    if (revised.bullets.some((bullet) => bullet.reverted)) continue;
    accepted.push(ref);
    entries.push(revised);
  }
  return { output: { ...first, entries }, accepted };
}

export function notesForAccepted(
  notes: ReadonlyMap<string, BulletNote>,
  revisionNotes: ReadonlyMap<string, BulletNote>,
  accepted: readonly string[],
  output: ValidatedTailorOutput,
): Map<string, BulletNote> {
  const next = new Map(notes);
  const ok = new Set(accepted);
  for (const entry of output.entries) {
    if (!ok.has(entry.ref)) continue;
    for (const bullet of entry.bullets) {
      const note = revisionNotes.get(sourceKey(bullet.sourceRefs));
      if (note) next.set(sourceKey(bullet.sourceRefs), note);
    }
  }
  return next;
}

function addSource(
  targets: Map<string, RevisionTarget>,
  entryRef: string,
  reason: RevisionTarget["reason"],
  requirementId: string,
  source: RevisionSource,
): void {
  const count = [...targets.values()].reduce((sum, target) => sum + target.unused.length, 0);
  if (count >= MAX_SOURCES) return;
  const existing = targets.get(entryRef);
  if (existing) {
    if (existing.unused.some((item) => item.ref === source.ref)) {
      if (requirementId && !existing.requirementIds.includes(requirementId)) {
        existing.requirementIds.push(requirementId);
      }
      return;
    }
    if (reason === "omitted_evidence") existing.reason = "omitted_evidence";
    if (requirementId) existing.requirementIds.push(requirementId);
    existing.unused.push(source);
    return;
  }
  if (targets.size >= MAX_ENTRIES) return;
  targets.set(entryRef, {
    entryRef,
    reason,
    requirementIds: requirementId ? [requirementId] : [],
    unused: [source],
    current: [],
  });
}

const VAGUE =
  /\b(responsible for|duties included|tasked with|helped with|assisted with|worked on|participated in|various tasks)\b/i;

const HANDS_ON =
  /\b(built|implemented|developed|tested|integrated|deployed|debugged)\b/i;

/**
 * A selected line that hides job-relevant facts its own sources already state.
 * Two omitted terms, or a vague line hiding one, is enough. A specific line is not.
 */
function addUnderspecified(
  targets: Map<string, RevisionTarget>,
  output: ValidatedTailorOutput,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  analysis: JobAnalysis,
): void {
  const terms = jobTerms(analysis);
  if (terms.length === 0) return;
  for (const row of output.entries) {
    const entry = byRef.get(row.ref);
    if (!entry || entry.kind === "EDUCATION" || entry.kind === "CERTIFICATION") continue;
    for (const bullet of row.bullets) {
      const sources = bullet.sourceRefs
        .map((ref) => entry.bullets.find((item) => item.ref === ref))
        .filter((item): item is SnapshotEntry["bullets"][number] => item !== undefined);
      if (sources.length === 0) continue;
      const omitted = terms.filter(
        (term) =>
          sources.some((source) => hasTerm(source.text, term)) && !hasTerm(bullet.text, term),
      );
      const vague = VAGUE.test(bullet.text);
      const strong = sources.some((source) => HANDS_ON.test(source.text));
      if (omitted.length < 2 && !(vague && strong && omitted.length >= 1)) continue;
      for (const source of sources) {
        const relevant = omitted.some((term) => hasTerm(source.text, term));
        if (!relevant) continue;
        addSource(targets, entry.ref, "underspecified", "", {
          ref: source.ref,
          text: source.text,
        });
      }
    }
  }
}

function jobTerms(analysis: JobAnalysis): string[] {
  const terms = [...analysis.keywords];
  for (const requirement of analysis.requirements) {
    terms.push(...requirementTerms(requirement, analysis.keywords));
  }
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const term of terms) {
    const key = normalizeMatchText(term);
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    unique.push(term.trim());
  }
  return unique;
}

function hasTerm(text: string, term: string): boolean {
  return termAppears(normalizeMatchText(text), normalizeMatchText(term));
}

function undersoldEntry(
  output: ValidatedTailorOutput,
  byRef: ReadonlyMap<string, SnapshotEntry>,
  cited: ReadonlySet<string>,
): { entry: SnapshotEntry } | null {
  let best: SnapshotEntry | null = null;
  let hands = 0;
  for (const row of output.entries) {
    const entry = byRef.get(row.ref);
    if (!entry || entry.kind === "EDUCATION" || entry.kind === "CERTIFICATION") continue;
    const count = entry.bullets.filter((bullet) =>
      /\b(built|implemented|developed|tested|integrated|deployed|debugged)\b/i.test(bullet.text),
    ).length;
    if (count > hands) {
      best = entry;
      hands = count;
    }
  }
  if (!best || hands < 3) return null;
  const selected = output.entries.find((row) => row.ref === best.ref);
  if (!selected || selected.bullets.length >= 2) return null;
  const unused = best.bullets.filter((bullet) => !cited.has(bullet.ref));
  if (unused.length < 2) return null;
  return { entry: best };
}

function currentBullets(
  output: ValidatedTailorOutput,
  entryRef: string,
): RevisionTarget["current"] {
  const entry = output.entries.find((row) => row.ref === entryRef);
  if (!entry) return [];
  return entry.bullets.map((bullet) => ({
    sourceRefs: [...bullet.sourceRefs],
    text: bullet.text,
  }));
}

function citedRefs(output: ValidatedTailorOutput): Set<string> {
  const cited = new Set<string>();
  for (const entry of output.entries) {
    for (const bullet of entry.bullets) {
      for (const ref of bullet.sourceRefs) cited.add(ref);
    }
  }
  return cited;
}

function locate(
  ref: string,
  snapshot: LibrarySnapshot,
): { entry: SnapshotEntry; text: string } | null {
  for (const entry of snapshot.entries) {
    const bullet = entry.bullets.find((item) => item.ref === ref);
    if (bullet) return { entry, text: bullet.text };
  }
  return null;
}

function sameBullets(left: readonly ValidatedBullet[], right: readonly ValidatedBullet[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((bullet, index) => {
    const other = right[index];
    if (!other || !sameWording(bullet.text, other.text)) return false;
    return sourceKey(bullet.sourceRefs) === sourceKey(other.sourceRefs);
  });
}

function unique(refs: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    next.push(ref);
  }
  return next;
}

function sourceKey(refs: readonly string[]): string {
  return [...refs].sort().join("\0");
}

function clip(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 200 ? text.slice(0, 200) : text;
}
