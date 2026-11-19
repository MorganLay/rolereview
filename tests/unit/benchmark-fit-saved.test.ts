import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fitAtMostOne, fitResumeDocument, fitW4, fitW5, fitWithoutDrops, presentedPageCount, w3PageCount, w4PageCount } from "../../benchmarks/lib/fit";
import { baselineDocument } from "../../benchmarks/lib/plain-resume";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { presentedModel } from "../../benchmarks/lib/present";
import { presentW3 } from "../../benchmarks/write-verify/w3-display";
import { presentW4 } from "../../benchmarks/write-verify/w4-display";
import { resumePdfModel } from "@/lib/pdf/model";
import { renderResumePdf } from "@/lib/pdf/render";
import { resumePlainText } from "@/features/tailor/plainText";
import { measureResumePages } from "@/features/tailor/page-fit";
import type { ResumeContent } from "@/features/tailor/schemas";

const directory = process.env.BENCHMARK_FIT_DIR;

describe("saved benchmark page fit", () => {
  it("fits both arms with the production page fitter when a results directory is set", async () => {
    if (!directory) return;
    if (process.env.BENCHMARK_FIT_MODE === "w3mix" || process.env.BENCHMARK_FIT_MODE === "w4mix" || process.env.BENCHMARK_FIT_MODE === "w5mix") {
      const packets = readdirSync(directory).filter((name) => name.endsWith(".direct.blind-input.json"));
      for (const name of packets) {
        const saved = JSON.parse(readFileSync(path.join(directory, name), "utf8")) as { text: string };
        const doc = baselineDocument(saved.text);
        const pdf = await renderResumePdf(resumePdfModel(doc.content, doc.snapshot), "classic", {
          pages: 2,
          producedAt: new Date("2026-11-14T00:00:00.000Z"),
        });
        writeFileSync(path.join(directory, name.replace(/\.direct\.blind-input\.json$/, ".direct.blind.pdf")), pdf);
      }
    }
    const files = readdirSync(directory).filter((name) => name.endsWith(".fit-input.json"));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const input = JSON.parse(readFileSync(path.join(directory, name), "utf8")) as {
        role: { content: ResumeContent; snapshot: LibrarySnapshot } | null;
        baseline: { content: ResumeContent; snapshot: LibrarySnapshot } | null;
      };
      if (process.env.BENCHMARK_FIT_MODE === "present-count") {
        const pages = input.role
          ? name.includes(".W5.")
            ? await w4PageCount(input.role.content, input.role.snapshot, false)
            : name.includes(".W4.")
              ? await w4PageCount(input.role.content, input.role.snapshot, compactLayout(directory))
              : name.includes(".W3.")
                ? await w3PageCount(input.role.content, input.role.snapshot)
                : await presentedPageCount(input.role.content, input.role.snapshot)
          : null;
        writeFileSync(
          path.join(directory, name.replace(/\.fit-input\.json$/, ".pages.json")),
          JSON.stringify({ pages }, null, 2),
        );
        continue;
      }
      if (process.env.BENCHMARK_FIT_MODE === "w4-layout") {
        if (!(name.includes("P001-J001.W4.") && input.role)) continue;
        const stacked = await w4PageCount(input.role.content, input.role.snapshot, false);
        const compact = await w4PageCount(input.role.content, input.role.snapshot, true);
        const stackedPdf = await renderResumePdf(presentW4(input.role.content, input.role.snapshot, { compactExperience: false }), "classic", {
          pages: 2,
          producedAt: new Date("2026-11-14T00:00:00.000Z"),
        });
        const compactPdf = await renderResumePdf(presentW4(input.role.content, input.role.snapshot, { compactExperience: true }), "classic", {
          pages: 2,
          producedAt: new Date("2026-11-14T00:00:00.000Z"),
        });
        writeFileSync(path.join(directory, "P001-J001.W4.stacked.pdf"), stackedPdf);
        writeFileSync(path.join(directory, "P001-J001.W4.compact.pdf"), compactPdf);
        writeFileSync(
          path.join(directory, "P001-J001.W4.layout.json"),
          JSON.stringify({ stackedPages: stacked, compactPages: compact }, null, 2),
        );
        continue;
      }
      if (process.env.BENCHMARK_FIT_MODE === "w5mix" && name.includes(".W5.") && input.role) {
        const roleDoc = await fitW5(input.role.content, input.role.snapshot);
        const stem = name.replace(/\.fit-input\.json$/, "");
        writeFileSync(path.join(directory, `${stem}.txt`), roleDoc.text);
        const pdf = await renderResumePdf(presentW4(roleDoc.content, input.role.snapshot), "classic", {
          pages: roleDoc.pageLimit === 1 ? 1 : 2,
          producedAt: new Date("2026-11-14T00:00:00.000Z"),
        });
        writeFileSync(path.join(directory, `${stem}.pdf`), pdf);
        writeFileSync(
          path.join(directory, name.replace(/\.fit-input\.json$/, ".fitted.json")),
          JSON.stringify({ role: savedFit(roleDoc), baseline: emptyBaseline() }, null, 2),
        );
        continue;
      }
      if (process.env.BENCHMARK_FIT_MODE === "w4mix" && name.includes(".W4.") && input.role) {
        const compact = compactLayout(directory);
        const roleDoc = await fitW4(input.role.content, input.role.snapshot, compact);
        const stem = name.replace(/\.fit-input\.json$/, "");
        writeFileSync(path.join(directory, `${stem}.txt`), roleDoc.text);
        const pdf = await renderResumePdf(presentW4(roleDoc.content, input.role.snapshot, { compactExperience: compact }), "classic", {
          pages: roleDoc.pageLimit === 1 ? 1 : 2,
          producedAt: new Date("2026-11-14T00:00:00.000Z"),
        });
        writeFileSync(path.join(directory, `${stem}.pdf`), pdf);
        writeFileSync(
          path.join(directory, name.replace(/\.fit-input\.json$/, ".fitted.json")),
          JSON.stringify({ role: savedFit(roleDoc), baseline: emptyBaseline() }, null, 2),
        );
        continue;
      }
      if (process.env.BENCHMARK_FIT_MODE === "w3mix" && name.includes(".W3.") && input.role) {
        const roleDoc = await fitWithoutDrops(input.role.content, input.role.snapshot);
        const stem = name.replace(/\.fit-input\.json$/, "");
        writeFileSync(path.join(directory, `${stem}.txt`), roleDoc.text);
        const pdf = await renderResumePdf(presentW3(roleDoc.content, input.role.snapshot), "classic", {
          pages: roleDoc.pageLimit === 1 ? 1 : 2,
          producedAt: new Date("2026-11-14T00:00:00.000Z"),
        });
        writeFileSync(path.join(directory, `${stem}.pdf`), pdf);
        writeFileSync(
          path.join(directory, name.replace(/\.fit-input\.json$/, ".fitted.json")),
          JSON.stringify({ role: savedFit(roleDoc), baseline: emptyBaseline() }, null, 2),
        );
        continue;
      }
      const roleDoc = input.role
        ? process.env.BENCHMARK_FIT_MODE === "one"
          ? await fitAtMostOne(input.role.content, input.role.snapshot)
          : process.env.BENCHMARK_FIT_MODE === "count"
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
  }, 180_000);
});

function compactLayout(directory: string): boolean {
  try {
    const parsed = JSON.parse(readFileSync(path.join(directory, "w4-layout.json"), "utf8")) as { compactExperience?: boolean };
    return parsed.compactExperience === true;
  } catch {
    return false;
  }
}

function emptyBaseline() {
  return { text: "", pageLimit: null, dropped: [], measured: false, note: "Baseline was not refit." };
}

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
  const pdf = await renderResumePdf(presentedModel(content, snapshot), "classic", {
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
