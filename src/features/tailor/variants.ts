/**
 * Approved wording the tailor may select. A variant is not a match score.
 * Job-specific wording is included only for the job being tailored.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";

import type { TailorOutput } from "./schemas";

export type SavedWording = {
  id: string;
  bulletId: string | null;
  jobId: string | null;
  text: string;
  reason: string | null;
};

export type ModelBullet = {
  sourceRefs: readonly string[];
  text: string;
  variantId?: string | null;
  choice?: string | null;
  why?: string | null;
};

type ModelEntry = {
  ref: string;
  bullets: readonly ModelBullet[];
};

export type ModelTailor = {
  summary: string;
  entries: readonly ModelEntry[];
  skills: TailorOutput["skills"];
  requirementMatches: TailorOutput["requirementMatches"];
};

export function variantPrompt(
  snapshot: LibrarySnapshot,
  variants: readonly SavedWording[],
): string {
  const lines: string[] = [];
  for (const entry of snapshot.entries) {
    for (const bullet of entry.bullets) {
      const saved = variants.filter((variant) => variant.bulletId === bullet.id);
      if (saved.length === 0) continue;
      lines.push(`${bullet.ref} id=${bullet.id}`);
      for (const variant of saved) {
        const scope = variant.jobId ? "this job" : "reusable";
        const reason = variant.reason?.trim() || "Saved wording";
        lines.push(
          `  variant ${variant.id} (${scope}): ${oneLine(variant.text)} | ${oneLine(reason)}`,
        );
      }
    }
  }
  return lines.length > 0 ? lines.join("\n") : "none";
}

/**
 * A "variant" choice uses that saved text. A "canonical" choice keeps the
 * library bullet. A rewrite is left for the guard.
 */
export function preferSavedWording(
  output: ModelTailor,
  variants: readonly SavedWording[],
  snapshot: LibrarySnapshot,
): { output: TailorOutput; why: Map<string, string> } {
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const bulletId = new Map<string, string>();
  const sourceText = new Map<string, string>();
  for (const entry of snapshot.entries) {
    for (const bullet of entry.bullets) {
      bulletId.set(bullet.ref, bullet.id);
      sourceText.set(bullet.ref, bullet.text);
    }
  }
  const why = new Map<string, string>();
  const entries = output.entries.map((entry) => ({
    ref: entry.ref,
    bullets: entry.bullets.map((bullet) => {
      const text = chosenText(bullet, byId, bulletId, sourceText);
      const reason = bullet.why?.trim() ?? "";
      if (reason.length > 0 && text !== null) {
        why.set(sourceKey(bullet.sourceRefs), clip(reason, 200));
      }
      return { sourceRefs: [...bullet.sourceRefs], text: text ?? bullet.text };
    }),
  }));
  return {
    output: {
      summary: output.summary,
      entries,
      skills: output.skills.map((group) => ({
        category: group.category,
        refs: [...group.refs],
      })),
      requirementMatches: output.requirementMatches.map((match) => ({ ...match })),
    },
    why,
  };
}

function chosenText(
  bullet: ModelBullet,
  byId: ReadonlyMap<string, SavedWording>,
  bulletId: ReadonlyMap<string, string>,
  sourceText: ReadonlyMap<string, string>,
): string | null {
  if (bullet.choice === "canonical" && bullet.sourceRefs.length === 1) {
    const ref = bullet.sourceRefs[0];
    return ref ? (sourceText.get(ref) ?? null) : null;
  }
  if (bullet.choice !== "variant" || !bullet.variantId) return null;
  const variant = byId.get(bullet.variantId);
  if (!variant || variant.bulletId === null) return null;
  const cited = bullet.sourceRefs.some((ref) => bulletId.get(ref) === variant.bulletId);
  if (!cited) return null;
  return variant.text;
}

function sourceKey(refs: readonly string[]): string {
  return [...refs].sort().join("\0");
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
