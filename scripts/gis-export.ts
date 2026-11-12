/**
 * Renders a tailored resume with the same runner as the PDF unit tests.
 * tsx cannot load react-pdf's hyphenation data, and that failure is an export
 * failure, not a tailoring failure. Page count is read from the PDF bytes.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeContent } from "@/features/tailor/schemas";

export type GisExport = {
  pages: number | null;
  text: string;
  error: string | null;
};

export async function exportGisPdf(input: {
  content: ResumeContent;
  snapshot: LibrarySnapshot;
  pdfPath: string;
}): Promise<GisExport> {
  const dir = await mkdtemp(path.join(tmpdir(), "gis-pdf-"));
  const payloadPath = path.join(dir, "resume.json");
  const resultPath = path.join(dir, "result.json");
  await writeFile(
    payloadPath,
    JSON.stringify({ content: input.content, snapshot: input.snapshot }),
  );
  const vitest = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
  try {
    const stderr = await run(
      process.execPath,
      [vitest, "run", "tests/unit/gis-pdf-export.test.ts", "--reporter=dot"],
      {
        ...process.env,
        GIS_PDF_INPUT: payloadPath,
        GIS_PDF_OUTPUT: input.pdfPath,
        GIS_PDF_RESULT: resultPath,
      },
    );
    const raw = await readFile(resultPath, "utf8").catch(() => "");
    if (raw.length === 0) {
      return { pages: null, text: "", error: stderr.trim() || "The export process returned no result." };
    }
    const parsed = JSON.parse(raw) as GisExport;
    return {
      pages: typeof parsed.pages === "number" ? parsed.pages : null,
      text: typeof parsed.text === "string" ? parsed.text : "",
      error: typeof parsed.error === "string" ? parsed.error : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return { pages: null, text: "", error: message };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function run(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env, windowsHide: true });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", () => {
      resolve(stderr);
    });
  });
}
