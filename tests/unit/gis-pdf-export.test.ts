/**
 * Renders one resume the same way the download route does.
 * Invoked by scripts/gis-export.ts with GIS_PDF_INPUT, GIS_PDF_OUTPUT, and
 * GIS_PDF_RESULT set. A normal `npm test` skips it.
 */
import { readFile, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type { LibrarySnapshot } from "@/features/library/schemas";
import { enforcePageBudget } from "@/features/tailor/page-fit";
import { resumePlainText } from "@/features/tailor/plainText";
import type { ResumeContent } from "@/features/tailor/schemas";
import { resumePdfModel } from "@/lib/pdf/model";
import { fitResumePdf } from "@/lib/pdf/render";

const inputPath = process.env.GIS_PDF_INPUT;
const pdfPath = process.env.GIS_PDF_OUTPUT;
const resultPath = process.env.GIS_PDF_RESULT;

describe.skipIf(!inputPath || !pdfPath || !resultPath)("GIS PDF export", () => {
  it("writes the PDF and its page count", async () => {
    const resultFile = resultPath ?? "";
    try {
      const payload = JSON.parse(await readFile(inputPath ?? "", "utf8")) as {
        content: ResumeContent;
        snapshot: LibrarySnapshot;
      };
      const content = await enforcePageBudget(payload.content, payload.snapshot, 1);
      const fit = await fitResumePdf(resumePdfModel(content, payload.snapshot), "classic");
      await writeFile(pdfPath ?? "", fit.pdf);
      await writeFile(
        resultFile,
        JSON.stringify({
          pages: fit.pageCount,
          text: resumePlainText(content, payload.snapshot),
          error: null,
        }),
      );
      expect(fit.pageCount).toBeGreaterThan(0);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : "Export failed.";
      await writeFile(resultFile, JSON.stringify({ pages: null, text: "", error: message }));
      throw error;
    }
  });
});
