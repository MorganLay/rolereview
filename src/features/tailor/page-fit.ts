/**
 * After editorial selection, measure the classic layout and then fit it.
 * One page and two pages are ceilings. Automatic chooses between them from
 * the rendered resume. docs/05-AI.md → Composing the resume.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";
import { resumePdfModel } from "@/lib/pdf/model";
import { linesAfterFirstPage } from "@/lib/pdf/overflow";
import { pdfPageCount } from "@/lib/pdf/pages";
import { ONE_PAGE_FIT_STEPS, renderFitLayout, type FitLayout } from "@/lib/pdf/render";

import type { ContentBullet, ContentEntry, ResumeContent, ResumeLengthChoice, ResumeReviewItem } from "./schemas";

const MAX_PASSES = 8;

/** Text operators on a later page. A filled page sits well above this. */
const SPARSE_PAGE_LINES = 14;

const REGULAR: FitLayout = {
  step: "regular",
  spacing: "regular",
  type: "regular",
  groupLinks: false,
};

/** Spacing and link-row changes. Minimum type is reserved for an explicit one-page maximum. */
const BALANCED_FIT = ONE_PAGE_FIT_STEPS.slice(0, 2);

type Measured = { pages: number; extraLines: number };

export async function settlePageLength(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  choice: ResumeLengthChoice,
): Promise<ResumeContent> {
  const ceiling = choice === 1 ? 1 : 2;
  const fitted = await fitToCeiling(content, snapshot, ceiling, choice === 1);
  if (choice !== "auto") return { ...fitted, pageLimit: ceiling };
  return chooseAutomatic(fitted, snapshot);
}

/** Explicit one-page or two-page maximum. Automatic goes through settlePageLength. */
export async function enforcePageBudget(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  pages: 1 | 2,
): Promise<ResumeContent> {
  return settlePageLength(content, snapshot, pages);
}

async function fitToCeiling(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  ceiling: 1 | 2,
  allowMinimumType: boolean,
): Promise<ResumeContent> {
  const layouts = allowMinimumType ? ONE_PAGE_FIT_STEPS : [];
  let current = content;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const regular = await measure(current, snapshot, REGULAR);
    if (!regular) return current;
    if (regular.pages <= ceiling) return current;
    if (await layoutFits(current, snapshot, ceiling, layouts)) return current;
    const next = excludeLowest(current);
    if (!next) return note(current, "page", "page_overflow", "warning");
    current = next;
  }
  return note(current, "page", "page_overflow", "warning");
}

async function chooseAutomatic(content: ResumeContent, snapshot: LibrarySnapshot): Promise<ResumeContent> {
  const regular = await measure(content, snapshot, REGULAR);
  if (!regular) return { ...content, pageLimit: content.pageLimit ?? 2 };
  if (regular.pages <= 1) return mark(content, 1, "auto_one_page");
  if (await layoutFits(content, snapshot, 1, BALANCED_FIT)) return mark(content, 1, "auto_one_page");

  let current = content;
  let seen = regular;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    if (seen.extraLines === 0 || seen.extraLines > SPARSE_PAGE_LINES) {
      return mark(current, 2, "auto_two_pages");
    }
    const next = excludeMarginal(current);
    if (!next) return mark(current, 2, "auto_kept_sparse");
    const after = await measure(next, snapshot, REGULAR);
    if (!after || after.extraLines >= seen.extraLines) return mark(current, 2, "auto_kept_sparse");
    current = next;
    seen = after;
    if (after.pages <= 1 || (await layoutFits(current, snapshot, 1, BALANCED_FIT))) {
      return mark(current, 1, "auto_one_page");
    }
  }
  return mark(current, 2, seen.extraLines > SPARSE_PAGE_LINES ? "auto_two_pages" : "auto_kept_sparse");
}

async function layoutFits(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  ceiling: number,
  layouts: readonly FitLayout[],
): Promise<boolean> {
  for (const layout of layouts) {
    const measured = await measure(content, snapshot, layout);
    if (measured && measured.pages <= ceiling) return true;
  }
  return false;
}

async function measure(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  layout: FitLayout,
): Promise<Measured | null> {
  try {
    const pdf = await renderFitLayout(resumePdfModel(content, snapshot), "classic", layout);
    const pages = pdfPageCount(pdf);
    return { pages, extraLines: pages <= 1 ? 0 : linesAfterFirstPage(pdf) };
  } catch {
    return null;
  }
}

function mark(content: ResumeContent, pageLimit: 1 | 2, reason: string): ResumeContent {
  return note({ ...content, pageLimit }, "length", reason, "note");
}

function excludeLowest(content: ResumeContent): ResumeContent | null {
  const ranked = included(content);
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

/** A line that can leave a short second page. Lead lines, and the last line of a support entry, stay. */
function excludeMarginal(content: ResumeContent): ResumeContent | null {
  const planned = (content.plan?.evidence?.length ?? 0) > 0;
  const candidates = included(content)
    .filter((item) => !protects(item.weight, item.count, planned))
    .sort((left, right) => left.weight - right.weight || right.count - left.count);
  const pick = candidates[0];
  if (!pick) return null;
  const bullet = lastIncluded(pick.entry);
  if (!bullet) return null;
  return turnOff(content, pick.entry.ref, bullet.id);
}

function protects(weight: number, count: number, planned: boolean): boolean {
  if (!planned) return count <= 1;
  if (weight >= 3) return true;
  return weight === 2 && count <= 1;
}

function included(content: ResumeContent): { entry: ContentEntry; weight: number; count: number }[] {
  return content.entries
    .filter((entry) => entry.included && entry.kind !== "EDUCATION")
    .map((entry) => ({
      entry,
      weight: entryWeight(content, entry.ref),
      count: entry.bullets.filter((bullet) => bullet.included).length,
    }))
    .filter((item) => item.count > 0);
}

function entryWeight(content: ResumeContent, ref: string): number {
  const matches = (content.plan?.evidence ?? []).filter((row) => row.ref === ref);
  if (matches.length === 0) return 1;
  return Math.max(...matches.map((row) => (row.use === "lead" ? 3 : row.use === "support" ? 2 : 0)));
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

function reviewCode(reason: string): ResumeReviewItem["code"] {
  if (reason === "page_budget") return "BULLET_PREFERENCE";
  if (reason.startsWith("auto_")) return "PRESENTATION";
  return "ENTRY_EXCLUDED";
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
      code: reviewCode(reason),
      severity,
      ref,
      reason,
    });
  }
  return { ...content, review };
}
