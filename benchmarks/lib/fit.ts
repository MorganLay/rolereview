/**
 * Page fit for both benchmark arms. Same classic layout and the same
 * automatic ceiling as production. This does not change editorial selection
 * before fitting.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import { settlePageLength } from "@/features/tailor/page-fit";
import type { ResumeContent } from "@/features/tailor/schemas";
import { resumePdfLines } from "@/lib/pdf/model";
import { pdfPageCount } from "@/lib/pdf/pages";
import { renderResumePdf } from "@/lib/pdf/render";

import { presentW3 } from "../write-verify/w3-display";
import { presentW4 } from "../write-verify/w4-display";
import { displayContent, displaySnapshot, presentedModel, presentedText } from "./present";
import { baselineDocument } from "./plain-resume";

export { baselineDocument };

export type FittedResume = {
  text: string;
  pageLimit: 1 | 2 | null;
  dropped: string[];
  measured: boolean;
  note: string;
};

export async function fitResumeDocument(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): Promise<FittedResume & { content: ResumeContent }> {
  const before = includedBullets(content);
  try {
    const shown = displaySnapshot(snapshot);
    const prepared = displayContent(content, snapshot);
    const fitted = await settlePageLength(prepared, shown, "auto");
    const after = new Set(includedBullets(fitted));
    const dropped = before.filter((line) => !after.has(line));
    const measured = (fitted.review ?? []).some(
      (item) => item.reason.startsWith("auto_") || item.reason === "page_overflow",
    );
    return {
      content: fitted,
      text: presentedText(fitted, snapshot),
      pageLimit: measured ? fitted.pageLimit ?? null : null,
      dropped,
      measured,
      note: measured
        ? `Automatic page fit on the classic layout. Ceiling ${fitted.pageLimit}.`
        : "Page fit did not measure a PDF. The composed text is unchanged.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Page fit failed.";
    return {
      content,
      text: presentedText(content, snapshot),
      pageLimit: null,
      dropped: [],
      measured: false,
      note: message,
    };
  }
}

/** W4 page fit. The production fitter's drops are restored, then the W4 renderer is what gets saved. */
export async function fitW4(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  compactExperience = false,
): Promise<FittedResume & { content: ResumeContent; pages: number | null }> {
  const fitted = await fitWithoutDrops(content, snapshot);
  const pages = await w4PageCount(fitted.content, snapshot, compactExperience);
  return {
    ...fitted,
    pages,
    pageLimit: pages === 1 ? 1 : pages === null ? null : 2,
    text: resumePdfLines(presentW4(fitted.content, snapshot, { compactExperience })).join("\n"),
    content: { ...fitted.content, pageLimit: pages === 1 ? 1 : 2 },
  };
}

/** W5 page fit. The production fitter does not run, so it removes nothing. */
export async function fitW5(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): Promise<FittedResume & { content: ResumeContent; pages: number | null }> {
  const pages = await w4PageCount(content, snapshot, false);
  return {
    content: { ...content, pageLimit: pages === 1 ? 1 : 2 },
    text: resumePdfLines(presentW4(content, snapshot)).join("\n"),
    pageLimit: pages === 1 ? 1 : pages === null ? null : 2,
    pages,
    dropped: [],
    measured: pages !== null,
    note: "Fitter removed nothing.",
  };
}

/** Page count of the W4 render. Compact experience puts the employer and dates on the title line. */
export async function w4PageCount(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  compactExperience = false,
): Promise<number | null> {
  try {
    const pdf = await renderResumePdf(presentW4(content, snapshot, { compactExperience }), "classic", {
      pages: 2,
      producedAt: PRODUCED_AT,
    });
    return pdfPageCount(pdf);
  } catch {
    return null;
  }
}

/** Page count of the W3 render. Education lines and headings differ from production. */
export async function w3PageCount(content: ResumeContent, snapshot: LibrarySnapshot): Promise<number | null> {
  try {
    const pdf = await renderResumePdf(presentW3(content, snapshot), "classic", {
      pages: 2,
      producedAt: PRODUCED_AT,
    });
    return pdfPageCount(pdf);
  } catch {
    return null;
  }
}

/**
 * Runs the production fitter and then puts every removed line back.
 * The returned dropped list is what the fitter would have removed.
 */
export async function fitWithoutDrops(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): Promise<FittedResume & { content: ResumeContent; pages: number | null }> {
  const shown = displaySnapshot(snapshot);
  const prepared = displayContent(content, snapshot);
  const textById = new Map(
    prepared.entries.flatMap((entry) => entry.bullets.map((bullet) => [bullet.id, bullet.text] as const)),
  );
  try {
    const settled = await settlePageLength(prepared, shown, "auto");
    const before = new Set(includedIds(prepared));
    const after = new Set(includedIds(settled));
    const dropped = [...before].filter((id) => !after.has(id)).map((id) => textById.get(id) ?? id);
    const restored = restore(settled, new Set([...before].filter((id) => !after.has(id))));
    const pages = await w3PageCount(restored, snapshot);
    return {
      content: { ...restored, pageLimit: pages === 1 ? 1 : 2 },
      text: resumePdfLines(presentW3(restored, snapshot)).join("\n"),
      pageLimit: pages === 1 ? 1 : pages === null ? null : 2,
      pages,
      dropped,
      measured: pages !== null,
      note: dropped.length > 0 ? `Fitter would remove ${dropped.length} line(s). They stayed on the page.` : "Fitter removed nothing.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Page fit failed.";
    return {
      content,
      text: resumePdfLines(presentW3(content, snapshot)).join("\n"),
      pageLimit: null,
      pages: null,
      dropped: [],
      measured: false,
      note: message,
    };
  }
}

export async function fitResume(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): Promise<FittedResume> {
  const fitted = await fitResumeDocument(content, snapshot);
  return {
    text: fitted.text,
    pageLimit: fitted.pageLimit,
    dropped: fitted.dropped,
    measured: fitted.measured,
    note: fitted.note,
  };
}

const PRODUCED_AT = new Date("2026-11-14T00:00:00.000Z");

/** Page count of the resume a reader sees, including the benchmark render fixes. */
export async function presentedPageCount(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): Promise<number | null> {
  try {
    const pdf = await renderResumePdf(presentedModel(content, snapshot), "classic", {
      pages: 2,
      producedAt: PRODUCED_AT,
    });
    return pdfPageCount(pdf);
  } catch {
    return null;
  }
}

/**
 * Fits toward one page. The production fitter may turn off many lines;
 * this keeps at most one of those lines off and turns the rest back on.
 */
export async function fitAtMostOne(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): Promise<FittedResume & { content: ResumeContent; pages: number | null }> {
  const shown = displaySnapshot(snapshot);
  const prepared = displayContent(content, snapshot);
  const pagesNow = await presentedPageCount(prepared, snapshot);
  if (pagesNow !== null && pagesNow <= 1) {
    return {
      content: { ...prepared, pageLimit: 1 },
      text: presentedText(prepared, snapshot),
      pageLimit: 1,
      pages: 1,
      dropped: [],
      measured: true,
      note: "Already within one page.",
    };
  }
  const before = new Set(includedIds(prepared));
    const textById = new Map(
      prepared.entries.flatMap((entry) => entry.bullets.map((bullet) => [bullet.id, bullet.text] as const)),
    );
    try {
    const settled = await settlePageLength(prepared, shown, "auto");
    const after = new Set(includedIds(settled));
    const dropped = [...before].filter((id) => !after.has(id));
    const keptOff = dropped.slice(0, 1).map((id) => textById.get(id) ?? id);
    const restored = restore(settled, new Set(dropped.slice(1)));
    const pages = await presentedPageCount(restored, snapshot);
    return {
      content: { ...restored, pageLimit: pages === 1 ? 1 : 2 },
      text: presentedText(restored, snapshot),
      pageLimit: pages === 1 ? 1 : pages === null ? null : 2,
      pages,
      dropped: keptOff,
      measured: pages !== null,
      note:
        dropped.length > 1
          ? `Fitter chose ${dropped.length} lines. One stayed off.`
          : dropped.length === 1
            ? "Fitter removed one line."
            : "Fitter removed no lines.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Page fit failed.";
    return {
      content,
      text: presentedText(content, snapshot),
      pageLimit: null,
      pages: null,
      dropped: [],
      measured: false,
      note: message,
    };
  }
}

function includedIds(content: ResumeContent): string[] {
  return content.entries.flatMap((entry) =>
    entry.included ? entry.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.id) : [],
  );
}

function restore(content: ResumeContent, ids: Set<string>): ResumeContent {
  if (ids.size === 0) return content;
  return {
    ...content,
    entries: content.entries.map((entry) => ({
      ...entry,
      bullets: entry.bullets.map((bullet) => (ids.has(bullet.id) ? { ...bullet, included: true } : bullet)),
    })),
  };
}

function includedBullets(content: ResumeContent): string[] {
  return content.entries.flatMap((entry) =>
    entry.included ? entry.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.text) : [],
  );
}
