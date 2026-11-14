import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fitResumeDocument } from "../../benchmarks/lib/fit";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { resumePdfModel } from "@/lib/pdf/model";
import { renderResumePdf } from "@/lib/pdf/render";
import { resumePlainText } from "@/features/tailor/plainText";
import { measureResumePages } from "@/features/tailor/page-fit";
import type { ResumeContent } from "@/features/tailor/schemas";

const directory = process.env.BENCHMARK_FIT_DIR;

describe("saved benchmark page fit", () => {
  it("fits both arms with the production page fitter when a results directory is set", async () => {
    if (!directory) return;
    const files = readdirSync(directory).filter((name) => name.endsWith(".fit-input.json"));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const input = JSON.parse(readFileSync(path.join(directory, name), "utf8")) as {
        role: { content: ResumeContent; snapshot: LibrarySnapshot } | null;
        baseline: { content: ResumeContent; snapshot: LibrarySnapshot } | null;
      };
      const roleDoc = input.role
        ? process.env.BENCHMARK_FIT_MODE === "count"
          ? null
          : await fitResumeDocument(input.role.content, input.role.snapshot)
        : null;
      const role = input.role
        ? process.env.BENCHMARK_FIT_MODE === "count"
          ? await countOnly(input.role.content, input.role.snapshot)
          : savedFit(roleDoc)
        : { text: "", pageLimit: null, dropped: [], measured: false, note: "RoleRefine did not compose a resume." };
      const baselineDoc = input.baseline
        ? await fitResumeDocument(input.baseline.content, input.baseline.snapshot)
        : null;
      const baseline = baselineDoc
        ? savedFit(baselineDoc)
        : { text: "", pageLimit: null, dropped: [], measured: false, note: "Baseline was not available." };
      if (process.env.BENCHMARK_WRITE_PDF === "1") {
        const stem = name.replace(/\.fit-input\.json$/, "");
        if (roleDoc && input.role) await writePdf(directory, stem, roleDoc.content, input.role.snapshot, roleDoc.text);
        if (baselineDoc && input.baseline) {
          await writePdf(directory, `${stem}.baseline`, baselineDoc.content, input.baseline.snapshot, baselineDoc.text);
        }
      }
      writeFileSync(
        path.join(directory, name.replace(/\.fit-input\.json$/, ".fitted.json")),
        JSON.stringify({ role, baseline }, null, 2),
      );
    }
  }, 120_000);
});

function savedFit(
  fitted: { text: string; pageLimit: 1 | 2 | null; dropped: string[]; measured: boolean; note: string } | null,
) {
  return fitted ?? { text: "", pageLimit: null, dropped: [], measured: false, note: "Not measured." };
}

async function writePdf(
  directory: string,
  stem: string,
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  text: string,
): Promise<void> {
  writeFileSync(path.join(directory, `${stem}.txt`), text);
  const pdf = await renderResumePdf(resumePdfModel(content, snapshot), "classic", {
    pages: content.pageLimit === 1 ? 1 : 2,
    producedAt: new Date("2026-11-14T00:00:00.000Z"),
  });
  writeFileSync(path.join(directory, `${stem}.pdf`), pdf);
}

async function countOnly(content: ResumeContent, snapshot: LibrarySnapshot) {
  const counted = await measureResumePages(content, snapshot);
  const pages = counted?.pages ?? null;
  return {
    text: resumePlainText(content, snapshot),
    pageLimit: pages === 1 || pages === 2 ? pages : null,
    pages,
    dropped: [] as string[],
    measured: counted !== null,
    note: counted ? `Counted ${pages} pages. No lines were removed.` : "Page count failed.",
  };
}
