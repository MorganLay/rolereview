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
  const included = content.entries.filter((entry) => entry.included);
  const projects = included.filter((entry) => entry.kind === "PROJECT");
  const extraProject = projects.length > 1 ? projects[projects.length - 1] : undefined;
  if (extraProject) {
    const bullet = lastIncluded(extraProject);
    if (bullet) return turnOff(content, extraProject.ref, bullet.id);
  }
  const crowded = included
    .map((entry) => ({ entry, count: entry.bullets.filter((bullet) => bullet.included).length }))
    .filter((item) => item.count > 1)
    .sort((left, right) => right.count - left.count)[0];
  if (crowded) {
    const bullet = lastIncluded(crowded.entry);
    if (bullet) return turnOff(content, crowded.entry.ref, bullet.id);
  }
  return null;
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
