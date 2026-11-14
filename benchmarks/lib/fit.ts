/**
 * Page fit for both benchmark arms. Same classic layout and the same
 * automatic ceiling as production. This does not change editorial selection
 * before fitting.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import { settlePageLength } from "@/features/tailor/page-fit";
import { resumePlainText } from "@/features/tailor/plainText";
import type { ResumeContent } from "@/features/tailor/schemas";

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
    const fitted = await settlePageLength(content, snapshot, "auto");
    const after = new Set(includedBullets(fitted));
    const dropped = before.filter((line) => !after.has(line));
    const measured = (fitted.review ?? []).some(
      (item) => item.reason.startsWith("auto_") || item.reason === "page_overflow",
    );
    return {
      content: fitted,
      text: resumePlainText(fitted, snapshot),
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
      text: resumePlainText(content, snapshot),
      pageLimit: null,
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

function includedBullets(content: ResumeContent): string[] {
  return content.entries.flatMap((entry) =>
    entry.included ? entry.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.text) : [],
  );
}
