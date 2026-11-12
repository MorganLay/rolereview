/**
 * Turns included lines off until the regular classic layout fits the page
 * setting. Font size stays at the template default. A line that will not fit
 * stays in the resume, switched off, with a review note.
 * docs/05-AI.md → Composing the resume.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";
import { resumePdfModel } from "@/lib/pdf/model";
import { fitResumePdf } from "@/lib/pdf/render";

import type { ContentBullet, ContentEntry, ResumeContent, ResumeReviewItem } from "./schemas";

const MAX_PASSES = 8;

export async function enforcePageBudget(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  pages: 1 | 2,
): Promise<ResumeContent> {
  let current = content;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let pageCount = 1;
    try {
      const fit = await fitResumePdf(resumePdfModel(current, snapshot), "classic");
      pageCount = fit.pageCount;
    } catch {
      return current;
    }
    if (pageCount <= pages) return current;
    const next = excludeLowest(current);
    if (!next) return note(current, "page", "page_overflow", "warning");
    current = next;
  }
  return note(current, "page", "page_overflow", "warning");
}

function excludeLowest(content: ResumeContent): ResumeContent | null {
  const ranked = content.entries
    .filter((entry) => entry.included && entry.kind !== "EDUCATION")
    .map((entry) => ({
      entry,
      weight: entryWeight(content, entry.ref),
      count: entry.bullets.filter((bullet) => bullet.included).length,
    }))
    .filter((item) => item.count > 0);
  if (ranked.length === 0) return null;
  const weights = new Set(ranked.map((item) => item.weight));
  let pick = ranked[0];
  if (weights.size > 1) {
    pick = [...ranked].sort((left, right) => left.weight - right.weight || left.count - right.count)[0];
  } else {
    const crowded = [...ranked].sort((left, right) => right.count - left.count)[0];
    if (crowded && crowded.count > 1) pick = crowded;
    else pick = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;
  }
  if (!pick) return null;
  const bullet = lastIncluded(pick.entry);
  if (!bullet) return null;
  return turnOff(content, pick.entry.ref, bullet.id);
}

function entryWeight(content: ResumeContent, ref: string): number {
  const matches = (content.plan?.evidence ?? []).filter((row) => row.ref === ref);
  if (matches.length === 0) return 1;
  return Math.max(
    ...matches.map((row) => (row.use === "lead" ? 3 : row.use === "support" ? 2 : 0)),
  );
}

function lastIncluded(entry: ContentEntry): ContentBullet | undefined {
  return [...entry.bullets].reverse().find((bullet) => bullet.included);
}

function turnOff(content: ResumeContent, entryRef: string, bulletId: string): ResumeContent {
  const entries = content.entries.map((entry) => {
    if (entry.ref !== entryRef) return entry;
    const bullets = entry.bullets.map((bullet) =>
      bullet.id === bulletId ? { ...bullet, included: false } : bullet,
    );
    const still = bullets.some((bullet) => bullet.included);
    return { ...entry, included: still, bullets };
  });
  const target = content.entries
    .find((entry) => entry.ref === entryRef)
    ?.bullets.find((bullet) => bullet.id === bulletId);
  const ref = target?.sourceRefs[0] ?? bulletId;
  return note({ ...content, entries }, ref, "page_budget", "note");
}

function note(
  content: ResumeContent,
  ref: string,
  reason: string,
  severity: ResumeReviewItem["severity"],
): ResumeContent {
  const review = [...(content.review ?? [])];
  if (review.length < 80 && !review.some((item) => item.ref === ref && item.reason === reason)) {
    review.push({
      code: reason === "page_budget" ? "BULLET_PREFERENCE" : "ENTRY_EXCLUDED",
      severity,
      ref,
      reason,
    });
  }
  return { ...content, review };
}
