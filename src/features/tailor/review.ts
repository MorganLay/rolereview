/**
 * How a tailored resume explains itself.
 * Counts come from the saved resume and the live requirement states.
 * A note is shown only when it still describes the wording on screen.
 */

import type { Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";

import { sameWording } from "./grounding";
import { requirementState } from "./requirement-state";
import type { ContentBullet, RequirementVerdict, ResumeContent } from "./schemas";

const VAGUE =
  /\b(ats|more impactful|stronger keywords|better aligns|better aligned|keyword optimization)\b/i;

const GENERIC = new Set([
  "rephrased to emphasize the facts in this bullet that match the role.",
  "combined cited bullets from this role, without adding facts.",
]);

export type BulletReviewState = "none" | "applied" | "restored" | "edited";

export type DiffKind = "same" | "add" | "remove";

export type DiffPart = { kind: DiffKind; text: string };

export type BulletReview = {
  state: BulletReviewState;
  what: string | null;
  why: string | null;
  original: string;
  tailored: string | null;
  requirements: string[];
};

export type TailorDigest = {
  rewritten: number;
  unchanged: number;
  edited: number;
  excluded: number;
  summaryUpdated: boolean;
  projects: number;
  reverted: number;
  met: number;
  review: number;
  inLibrary: number;
  gaps: number;
};

/** Drop a note that does not name a real editorial reason. */
export function specificReason(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (text.length === 0) return null;
  if (GENERIC.has(text.toLowerCase())) return null;
  if (VAGUE.test(text)) return null;
  return text;
}

export function bulletReview(
  bullet: ContentBullet,
  sourceText: string,
  requirements: readonly Requirement[] = [],
): BulletReview {
  const original = (bullet.originalText ?? sourceText).trim();
  const current = bullet.text.trim();
  const storedTailored = bullet.suggestion?.trim() ?? "";
  const legacyTailored =
    storedTailored.length === 0 &&
    !bullet.edited &&
    !bullet.reverted &&
    original.length > 0 &&
    !sameWording(current, original)
      ? current
      : "";
  const tailoredText = storedTailored || legacyTailored;
  const hasTailored = tailoredText.length > 0 && !sameWording(tailoredText, original);
  const what = specificReason(bullet.changeWhat);
  const why = specificReason(bullet.suggestionNote);
  const named = requirementLines(bullet.requirementIds ?? [], requirements);

  if (hasTailored && sameWording(current, tailoredText)) {
    return {
      state: "applied",
      what,
      why,
      original,
      tailored: tailoredText,
      requirements: named,
    };
  }
  if (hasTailored && sameWording(current, original)) {
    return {
      state: "restored",
      what,
      why,
      original,
      tailored: tailoredText,
      requirements: named,
    };
  }
  if (original.length > 0 && !sameWording(current, original)) {
    return {
      state: "edited",
      what: null,
      why: null,
      original,
      tailored: hasTailored ? tailoredText : null,
      requirements: [],
    };
  }
  return {
    state: "none",
    what: null,
    why: null,
    original,
    tailored: null,
    requirements: [],
  };
}

/** Word-level comparison. Long lines are shown whole, as a removal and an addition. */
export function wordDiff(before: string, after: string): DiffPart[] {
  const left = tokenize(before);
  const right = tokenize(after);
  if (left.length === 0 && right.length === 0) return [];
  if (left.length > 80 || right.length > 80) {
    return [
      ...(left.length > 0 ? [{ kind: "remove" as const, text: left.join(" ") }] : []),
      ...(right.length > 0 ? [{ kind: "add" as const, text: right.join(" ") }] : []),
    ];
  }
  const table = lcs(left, right);
  const reversed: DiffPart[] = [];
  let i = left.length;
  let j = right.length;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      reversed.push({ kind: "same", text: left[i - 1] ?? "" });
      i -= 1;
      j -= 1;
    } else if ((table[i - 1]?.[j] ?? 0) >= (table[i]?.[j - 1] ?? 0)) {
      reversed.push({ kind: "remove", text: left[i - 1] ?? "" });
      i -= 1;
    } else {
      reversed.push({ kind: "add", text: right[j - 1] ?? "" });
      j -= 1;
    }
  }
  while (i > 0) {
    reversed.push({ kind: "remove", text: left[i - 1] ?? "" });
    i -= 1;
  }
  while (j > 0) {
    reversed.push({ kind: "add", text: right[j - 1] ?? "" });
    j -= 1;
  }
  reversed.reverse();
  const parts: DiffPart[] = [];
  for (const part of reversed) {
    if (part.text.length === 0) continue;
    const last = parts[parts.length - 1];
    if (last && last.kind === part.kind) last.text = `${last.text} ${part.text}`;
    else parts.push({ kind: part.kind, text: part.text });
  }
  return parts;
}

export function tailorDigest(input: {
  content: ResumeContent;
  snapshot: LibrarySnapshot;
  requirements: readonly Requirement[];
  verdicts: readonly RequirementVerdict[];
  keywords: readonly string[];
}): TailorDigest {
  const digest: TailorDigest = {
    rewritten: 0,
    unchanged: 0,
    edited: 0,
    excluded: 0,
    summaryUpdated: summaryChanged(input.content, input.snapshot),
    projects: input.content.entries.filter(
      (entry) => entry.kind === "PROJECT" && entry.included,
    ).length,
    reverted: 0,
    met: 0,
    review: 0,
    inLibrary: 0,
    gaps: 0,
  };

  for (const entry of input.content.entries) {
    const snapshotEntry = input.snapshot.entries.find((item) => item.ref === entry.ref);
    for (const bullet of entry.bullets) {
      const onResume = entry.included && bullet.included;
      if (!onResume) {
        digest.excluded += 1;
        continue;
      }
      if (bullet.reverted) {
        digest.reverted += 1;
        continue;
      }
      const source = sourceText(bullet, snapshotEntry);
      const review = bulletReview(bullet, source);
      if (review.state === "applied") digest.rewritten += 1;
      else if (review.state === "edited") digest.edited += 1;
      else digest.unchanged += 1;
    }
  }

  for (const requirement of input.requirements) {
    const verdict =
      input.verdicts.find((item) => item.requirementId === requirement.id) ?? null;
    const placement = requirementState({
      requirement,
      verdict,
      content: input.content,
      snapshot: input.snapshot,
      keywords: input.keywords,
    });
    if (placement.state === "in_resume") digest.met += 1;
    else if (placement.state === "needs_review") digest.review += 1;
    else if (placement.state === "in_library") digest.inLibrary += 1;
    else digest.gaps += 1;
  }

  return digest;
}

function summaryChanged(content: ResumeContent, snapshot: LibrarySnapshot): boolean {
  if (!content.summary.included) return false;
  const current = content.summary.text.trim();
  if (current.length === 0) return false;
  const library = snapshot.profile.summary?.trim() ?? "";
  return !sameWording(current, library);
}

function sourceText(
  bullet: ContentBullet,
  entry: LibrarySnapshot["entries"][number] | undefined,
): string {
  const ref = bullet.sourceRefs[0];
  const source = ref ? entry?.bullets.find((item) => item.ref === ref) : undefined;
  return source?.text ?? bullet.originalText ?? "";
}

function requirementLines(
  ids: readonly string[],
  requirements: readonly Requirement[],
): string[] {
  const lines: string[] = [];
  for (const id of ids) {
    const match = requirements.find((item) => item.id === id);
    const text = match?.text.trim() ?? "";
    if (text.length === 0 || lines.includes(text)) continue;
    lines.push(text);
    if (lines.length === 3) break;
  }
  return lines;
}

function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

function lcs(left: readonly string[], right: readonly string[]): number[][] {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const row = table[i];
      const above = table[i - 1];
      if (!row || !above) continue;
      row[j] =
        left[i - 1] === right[j - 1]
          ? (above[j - 1] ?? 0) + 1
          : Math.max(above[j] ?? 0, row[j - 1] ?? 0);
    }
  }
  return table;
}
