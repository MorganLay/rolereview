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
import { groupMembers } from "./stints";
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

export type EditorialDoubt = {
  code: "lead_missing" | "lead_thin" | "support_crowds" | "close_call";
  ref: string;
};

export type RevisionRoute =
  | { kind: "editorial"; doubts: EditorialDoubt[]; targets: RevisionTarget[] }
  | { kind: "entries"; targets: RevisionTarget[] }
  | { kind: "none" };

export type LibraryExcerpt = {
  ref: string;
  title: string;
  organization: string | null;
  kind: string;
  bullets: { ref: string; text: string }[];
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

/** One editorial call when a strategy exists and the draft does not carry it out. */
export function revisionRoute(input: {
  output: ValidatedTailorOutput;
  snapshot: LibrarySnapshot;
  analysis: JobAnalysis;
}): RevisionRoute {
  const doubts = editorialDoubts(input);
  const targets = revisionTargets(input);
  const directed = (input.output.plan?.evidence?.length ?? 0) > 0;
  if (directed && (doubts.length > 0 || targets.length > 0)) {
    return { kind: "editorial", doubts, targets };
  }
  if (targets.length > 0) return { kind: "entries", targets };
  return { kind: "none" };
}

/**
 * The draft disagrees with its own strategy. Keyword overlap is not a doubt.
 * A strategy that was never returned produces none.
 */
export function editorialDoubts(input: {
  output: ValidatedTailorOutput;
  snapshot: LibrarySnapshot;
}): EditorialDoubt[] {
  const evidence = input.output.plan?.evidence ?? [];
  if (evidence.length === 0) return [];
  const doubts: EditorialDoubt[] = [];
  const selected = new Map(input.output.entries.map((entry) => [entry.ref, entry]));
  for (const row of evidence) {
    if (row.use !== "lead") continue;
    const heading = selectedHeading(row.ref, input.snapshot, selected);
    if (!heading) {
      doubts.push({ code: "lead_missing", ref: row.ref });
      continue;
    }
    const unused = unusedSources(heading.ref, input.output, input.snapshot);
    if (row.bullets >= 2 && heading.bullets.length < row.bullets && unused > 0) {
      doubts.push({ code: "lead_thin", ref: heading.ref });
    }
  }
  const leadBullets = maxBullets(evidence, "lead", input.snapshot, selected);
  for (const row of evidence) {
    if (row.use !== "support") continue;
    const heading = selectedHeading(row.ref, input.snapshot, selected);
    if (!heading || leadBullets === 0) continue;
    if (heading.bullets.length >= leadBullets + 2) {
      doubts.push({ code: "support_crowds", ref: heading.ref });
    }
  }
  if (input.output.plan?.closeCall === true) doubts.push({ code: "close_call", ref: "strategy" });
  const seen = new Set<string>();
  return doubts.filter((doubt) => {
    const key = `${doubt.code}:${doubt.ref}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

export function editorialLibrary(input: {
  output: ValidatedTailorOutput;
  snapshot: LibrarySnapshot;
  targets?: readonly RevisionTarget[];
}): LibraryExcerpt[] {
  const byRef = new Map(input.snapshot.entries.map((entry) => [entry.ref, entry]));
  const ordered: string[] = [];
  const push = (ref: string) => {
    if (!byRef.has(ref) || ordered.includes(ref)) return;
    ordered.push(ref);
  };
  for (const row of input.output.plan?.evidence ?? []) {
    if (row.use === "lead") push(row.ref);
  }
  for (const target of input.targets ?? []) push(target.entryRef);
  for (const row of input.output.plan?.evidence ?? []) push(row.ref);
  for (const entry of input.output.entries) push(entry.ref);
  const excerpts: LibraryExcerpt[] = [];
  for (const ref of ordered) {
    if (excerpts.length >= 8) break;
    const entry = byRef.get(ref);
    if (!entry) continue;
    const bullets: LibraryExcerpt["bullets"] = [];
    for (const memberRef of groupMembers(input.snapshot.entries, input.snapshot.takenAt, ref)) {
      const member = byRef.get(memberRef);
      if (!member) continue;
      for (const bullet of member.bullets) {
        if (bullets.length >= 6) break;
        bullets.push({ ref: bullet.ref, text: bullet.text });
      }
    }
    excerpts.push({
      ref,
      title: entry.title,
      organization: entry.organization,
      kind: entry.kind,
      bullets,
    });
  }
  return excerpts;
}

export function acceptEditorial(
  first: ValidatedTailorOutput,
  second: ValidatedTailorOutput,
): { output: ValidatedTailorOutput; accepted: boolean } {
  if (second.entries.length === 0) return { output: first, accepted: false };
  if (second.entries.some((entry) => entry.bullets.some((bullet) => bullet.reverted))) {
    return { output: first, accepted: false };
  }
  if (second.entries.every((entry) => entry.bullets.length === 0)) {
    return { output: first, accepted: false };
  }
  const sameSummary = first.summary === second.summary;
  const sameEntries =
    first.entries.length === second.entries.length &&
    first.entries.every((entry, index) => {
      const other = second.entries[index];
      return other !== undefined && entry.ref === other.ref && sameBullets(entry.bullets, other.bullets);
    });
  if (sameSummary && sameEntries) return { output: first, accepted: false };
  return {
    output: {
      ...first,
      summary: second.summary,
      entries: second.entries,
      plan: second.plan ?? first.plan,
    },
    accepted: true,
  };
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

export function notesForEditorial(
  notes: ReadonlyMap<string, BulletNote>,
  entries: readonly {
    bullets: readonly {
      sourceRefs: readonly string[];
      what: string;
      why: string;
      requirementIds: readonly string[];
    }[];
  }[],
): Map<string, BulletNote> {
  const next = new Map(notes);
  for (const entry of entries) {
    for (const bullet of entry.bullets) {
      const what = clip(bullet.what);
      const why = clip(bullet.why);
      const requirementIds = bullet.requirementIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
        .slice(0, 8);
      if (what.length === 0 && why.length === 0 && requirementIds.length === 0) continue;
      next.set(sourceKey(bullet.sourceRefs), { what, why, requirementIds });
    }
  }
  return next;
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

function selectedHeading(
  ref: string,
  snapshot: LibrarySnapshot,
  selected: ReadonlyMap<string, ValidatedTailorOutput["entries"][number]>,
): ValidatedTailorOutput["entries"][number] | undefined {
  for (const member of groupMembers(snapshot.entries, snapshot.takenAt, ref)) {
    const heading = selected.get(member);
    if (heading) return heading;
  }
  return undefined;
}

function unusedSources(
  entryRef: string,
  output: ValidatedTailorOutput,
  snapshot: LibrarySnapshot,
): number {
  const cited = citedRefs(output);
  let unused = 0;
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  for (const memberRef of groupMembers(snapshot.entries, snapshot.takenAt, entryRef)) {
    const member = byRef.get(memberRef);
    if (!member) continue;
    for (const bullet of member.bullets) {
      if (!cited.has(bullet.ref)) unused += 1;
    }
  }
  return unused;
}

function maxBullets(
  evidence: NonNullable<ValidatedTailorOutput["plan"]>["evidence"],
  use: "lead" | "support",
  snapshot: LibrarySnapshot,
  selected: ReadonlyMap<string, ValidatedTailorOutput["entries"][number]>,
): number {
  let max = 0;
  for (const row of evidence ?? []) {
    if (row.use !== use) continue;
    const heading = selectedHeading(row.ref, snapshot, selected);
    if (heading && heading.bullets.length > max) max = heading.bullets.length;
  }
  return max;
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
