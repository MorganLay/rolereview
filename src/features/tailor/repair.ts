/**
 * One repair pass for rewrites the guard reverted.
 * The library is not an input that this module writes.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";

import { sameWording } from "./grounding";
import type { BulletNote } from "./variants";
import type { GuardResult } from "./validate";
import type { TailorOutput, ValidatedBullet, ValidatedTailorOutput } from "./schemas";

const REPAIRABLE = new Set(["G4", "G13", "G16"]);
const MAX_REPAIRS = 6;

export type RepairCode = "G4" | "G13" | "G16";

export type RepairTarget = {
  entryRef: string;
  sourceRef: string;
  sourceText: string;
  rejected: string;
  code: RepairCode;
};

export type RepairBullet = {
  sourceRef: string;
  text: string;
  what: string;
  why: string;
};

export function repairProblem(code: RepairCode): string {
  if (code === "G4") {
    return "The rejected wording added a number the source does not contain.";
  }
  if (code === "G16") {
    return "The rejected wording raised the role or the tool past the source.";
  }
  return "The rejected wording named a tool, credential, or claim the source does not support.";
}

/** Rewrites the guard put back. At most six, in guard order. */
export function repairTargets(
  before: TailorOutput,
  guard: GuardResult,
  snapshot: LibrarySnapshot,
): RepairTarget[] {
  const source = new Map<string, string>();
  for (const entry of snapshot.entries) {
    for (const bullet of entry.bullets) source.set(bullet.ref, bullet.text);
  }
  const model = new Map<string, { entryRef: string; text: string }>();
  for (const entry of before.entries) {
    for (const bullet of entry.bullets) {
      if (bullet.sourceRefs.length !== 1) continue;
      const ref = bullet.sourceRefs[0];
      if (!ref || model.has(ref)) continue;
      model.set(ref, { entryRef: entry.ref, text: bullet.text });
    }
  }

  const targets: RepairTarget[] = [];
  const seen = new Set<string>();
  for (const issue of guard.issues) {
    if (!REPAIRABLE.has(issue.code) || seen.has(issue.ref) || targets.length >= MAX_REPAIRS) {
      continue;
    }
    const attempt = model.get(issue.ref);
    const evidence = source.get(issue.ref);
    if (!attempt || evidence === undefined || sameWording(attempt.text, evidence)) continue;
    const guarded = guardedBullet(guard.output, issue.ref);
    if (!guarded?.reverted) continue;
    if (issue.code !== "G4" && issue.code !== "G13" && issue.code !== "G16") continue;
    seen.add(issue.ref);
    targets.push({
      entryRef: attempt.entryRef,
      sourceRef: issue.ref,
      sourceText: evidence,
      rejected: attempt.text,
      code: issue.code,
    });
  }
  return targets;
}

/** Replace only the targeted lines. Other bullets stay as the model wrote them. */
export function mergeRepair(
  before: TailorOutput,
  repairs: readonly RepairBullet[],
  targets: readonly RepairTarget[],
): TailorOutput {
  const allowed = new Set(targets.map((target) => target.sourceRef));
  const textByRef = new Map<string, string>();
  for (const repair of repairs) {
    const text = repair.text.trim();
    if (!allowed.has(repair.sourceRef) || text.length === 0) continue;
    textByRef.set(repair.sourceRef, repair.text);
  }
  return {
    ...before,
    entries: before.entries.map((entry) => ({
      ...entry,
      bullets: entry.bullets.map((bullet) => {
        const ref = bullet.sourceRefs.length === 1 ? bullet.sourceRefs[0] : undefined;
        if (!ref) return bullet;
        const text = textByRef.get(ref);
        return text ? { ...bullet, text } : bullet;
      }),
    })),
  };
}

/**
 * Keep a repaired line only when the second guard did not revert it.
 * The rest of the first guard result stays.
 */
export function applyAcceptedRepairs(
  first: ValidatedTailorOutput,
  second: ValidatedTailorOutput,
  targets: readonly RepairTarget[],
): { output: ValidatedTailorOutput; accepted: string[] } {
  const wanted = new Set(targets.map((target) => target.sourceRef));
  const replacement = new Map<string, ValidatedBullet>();
  const accepted: string[] = [];
  for (const entry of second.entries) {
    for (const bullet of entry.bullets) {
      const ref = bullet.sourceRefs.length === 1 ? bullet.sourceRefs[0] : undefined;
      if (!ref || !wanted.has(ref) || bullet.reverted || replacement.has(ref)) continue;
      replacement.set(ref, bullet);
      accepted.push(ref);
    }
  }
  if (accepted.length === 0) return { output: first, accepted };
  return {
    accepted,
    output: {
      ...first,
      entries: first.entries.map((entry) => ({
        ...entry,
        bullets: entry.bullets.map((bullet) => {
          const ref = bullet.sourceRefs[0];
          if (!ref || bullet.sourceRefs.length !== 1) return bullet;
          const next = replacement.get(ref);
          return next ? { ...bullet, text: next.text, reverted: false } : bullet;
        }),
      })),
    },
  };
}

export function withRepairNotes(
  notes: ReadonlyMap<string, BulletNote>,
  repairs: readonly RepairBullet[],
  accepted: readonly string[],
): Map<string, BulletNote> {
  const next = new Map(notes);
  const ok = new Set(accepted);
  for (const repair of repairs) {
    if (!ok.has(repair.sourceRef)) continue;
    const prior = next.get(repair.sourceRef);
    next.set(repair.sourceRef, {
      what: repair.what,
      why: repair.why,
      requirementIds: prior?.requirementIds ?? [],
    });
  }
  return next;
}

export function countRevertedBullets(output: ValidatedTailorOutput): number {
  let total = 0;
  for (const entry of output.entries) {
    for (const bullet of entry.bullets) {
      if (bullet.reverted) total += 1;
    }
  }
  return total;
}

function guardedBullet(
  output: ValidatedTailorOutput,
  sourceRef: string,
): ValidatedBullet | undefined {
  for (const entry of output.entries) {
    for (const bullet of entry.bullets) {
      if (bullet.sourceRefs.length === 1 && bullet.sourceRefs[0] === sourceRef) return bullet;
    }
  }
  return undefined;
}
