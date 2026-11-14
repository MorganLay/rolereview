/**
 * Mechanical composer for the model-led experiment.
 * It keeps validated model wording and section order.
 * It does not score keywords, swap in library wording, or drop a line for an estimated page budget.
 * The fabrication guard has already run. Page length is measured later by the PDF renderer.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import { isRedundantBullet, sameWording } from "@/features/tailor/grounding";
import type { EntryKind } from "@/features/tailor/resume-shape";
import { resumeSectionOrder } from "@/features/tailor/resume-shape";
import type { ResumeReviewItem, ValidatedBullet, ValidatedTailorOutput } from "@/features/tailor/schemas";
import { experienceGroups } from "@/features/tailor/stints";

import type { PlanRow } from "../lib/plan-compose";

export type ComposeAction = "kept" | "omitted" | "duplicate" | "unresolved" | "missing_draft" | "unsupported_source";

export type ComposeNote = {
  ref: string;
  action: ComposeAction;
  detail: string;
};

export function composeModelLed(input: {
  output: ValidatedTailorOutput;
  snapshot: LibrarySnapshot;
  decisions: readonly PlanRow[];
}): { output: ValidatedTailorOutput; notes: ComposeNote[]; sectionOrder: EntryKind[]; review: ResumeReviewItem[] } {
  const byRef = new Map(input.snapshot.entries.map((entry) => [entry.ref, entry]));
  const groups = experienceGroups(input.snapshot.entries, input.snapshot.takenAt);
  const omit = new Set(input.decisions.filter((row) => row.use === "omit").map((row) => row.ref));
  const keep = new Set(
    input.decisions.filter((row) => row.use === "lead" || row.use === "support").map((row) => row.ref),
  );
  const planned = input.decisions.length > 0;
  const notes: ComposeNote[] = [];
  const entries: ValidatedTailorOutput["entries"] = [];
  const keptText: string[] = [];
  const seen = new Set<string>();

  for (const entry of input.output.entries) {
    if (seen.has(entry.ref)) continue;
    seen.add(entry.ref);
    if (omit.has(entry.ref)) {
      notes.push({ ref: entry.ref, action: "omitted", detail: "The plan left this entry off." });
      continue;
    }
    if (planned && !keep.has(entry.ref)) {
      notes.push({ ref: entry.ref, action: "unresolved", detail: "The plan did not include this entry." });
      continue;
    }
    const library = byRef.get(entry.ref);
    const allowed = sourceRefsFor(entry.ref, input.snapshot, groups);
    const bullets: ValidatedBullet[] = [];
    for (const bullet of entry.bullets) {
      if (bullet.sourceRefs.length === 0 || bullet.sourceRefs.some((ref) => !allowed.has(ref))) {
        notes.push({ ref: entry.ref, action: "unsupported_source", detail: "A line cited a source this entry does not have." });
        continue;
      }
      if (keptText.some((earlier) => sameWording(earlier, bullet.text) || isRedundantBullet(earlier, bullet.text))) {
        notes.push({ ref: entry.ref, action: "duplicate", detail: "This line repeats a claim already kept." });
        continue;
      }
      bullets.push(bullet);
      keptText.push(bullet.text);
    }
    if (bullets.length === 0) {
      if (credentialHeading(library)) {
        notes.push({
          ref: entry.ref,
          action: "kept",
          detail: "The heading is the credential, so it stays without a line.",
        });
        entries.push({ ...entry, bullets: [] });
        continue;
      }
      notes.push({ ref: entry.ref, action: "missing_draft", detail: "No distinct grounded line remained, so the heading stays off." });
      continue;
    }
    notes.push({ ref: entry.ref, action: "kept", detail: `${bullets.length} grounded line${bullets.length === 1 ? "" : "s"} kept.` });
    entries.push({ ...entry, bullets });
  }

  for (const row of input.decisions) {
    if (seen.has(row.ref)) continue;
    if (row.use === "omit") {
      notes.push({ ref: row.ref, action: "omitted", detail: "The plan left this entry off." });
      continue;
    }
    const library = byRef.get(row.ref);
    if ((row.use === "lead" || row.use === "support") && credentialHeading(library)) {
      notes.push({
        ref: row.ref,
        action: "kept",
        detail: "The heading is the credential, so it stays without a line.",
      });
      entries.push({ ref: row.ref, bullets: [] });
      continue;
    }
    notes.push({ ref: row.ref, action: "missing_draft", detail: "The plan included this entry, and the draft had no line for it." });
  }

  const kinds = entries.map((entry) => byRef.get(entry.ref)?.kind).filter((kind): kind is EntryKind => kind !== undefined);
  return { output: { ...input.output, entries }, notes, sectionOrder: resumeSectionOrder(kinds), review: reviewOf(notes) };
}

function sourceRefsFor(
  entryRef: string,
  snapshot: LibrarySnapshot,
  groups: readonly { members: readonly string[] }[],
): Set<string> {
  const group = groups.find((item) => item.members.includes(entryRef));
  const members = new Set(group?.members ?? [entryRef]);
  const allowed = new Set<string>();
  for (const entry of snapshot.entries) {
    if (!members.has(entry.ref)) continue;
    allowed.add(entry.ref);
    for (const bullet of entry.bullets) allowed.add(bullet.ref);
  }
  return allowed;
}

function credentialHeading(
  entry: { kind: string; title: string } | undefined,
): boolean {
  if (!entry) return false;
  if (entry.kind !== "EDUCATION" && entry.kind !== "CERTIFICATION") return false;
  return entry.title.trim().length > 0;
}

function reviewOf(notes: readonly ComposeNote[]): ResumeReviewItem[] {
  return notes.slice(0, 40).map((note) => ({
    code: note.action === "kept" ? "ENTRY_INCLUDED" : note.action === "duplicate" || note.action === "unsupported_source" ? "BULLET_PREFERENCE" : "ENTRY_EXCLUDED",
    severity: note.action === "kept" ? "note" : "warning",
    ref: note.ref.slice(0, 80),
    reason: note.detail.slice(0, 80),
  }));
}
