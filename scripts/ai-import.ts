/**
 * Dev check for T4.2. Point it at a PDF or DOCX that lives outside this repo.
 * Prints the extraction in this terminal so you can judge it. Does not save
 * the library, and does not run when NODE_ENV is production.
 */
import "dotenv/config";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { strings } from "../src/copy/strings";
import { extractResumeForUser } from "../src/features/import/extract-resume";
import {
  DOCX_MIME,
  IMPORT_LIMITS,
  PDF_MIME,
} from "../src/features/import/schemas";
import { db } from "../src/lib/db";
import { env } from "../src/lib/env";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fileErrors = strings.library.import.errors;

function declaredType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".pdf")) return PDF_MIME;
  if (lower.endsWith(".docx")) return DOCX_MIME;
  return "";
}

async function main() {
  if (env.NODE_ENV === "production") {
    console.error("ai:import is dev only.");
    process.exitCode = 1;
    return;
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run ai:import -- <path-to.pdf-or.docx>");
    console.error("Keep the file outside this repo.");
    process.exitCode = 1;
    return;
  }

  const userId = env.SEED_USER_ID ?? "";
  if (!UUID.test(userId)) {
    console.error("Set SEED_USER_ID in .env to your Supabase user id.");
    process.exitCode = 1;
    return;
  }
  if (!env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY in .env.");
    process.exitCode = 1;
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      console.error("Pass a PDF or Word file.");
      process.exitCode = 1;
      return;
    }
    if (info.size > IMPORT_LIMITS.fileBytes) {
      console.error(fileErrors.fileSize);
      process.exitCode = 1;
      return;
    }

    const bytes = await readFile(filePath);
    const file = new File([bytes], path.basename(filePath), {
      type: declaredType(filePath),
    });
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true },
    });
    if (!user) {
      console.error(
        "No User row for SEED_USER_ID. Sign in once, then run this again.",
      );
      process.exitCode = 1;
      return;
    }

    console.log(`plan ${user.plan}`);
    const result = await extractResumeForUser(user, { source: "file", file });
    if (!result.ok) {
      const detail = Object.values(result.error.fields ?? {})
        .flat()
        .filter((message): message is string => typeof message === "string")
        .join(" ");
      console.error(detail ? `${result.error.code} ${detail}` : result.error.code);
      process.exitCode = 1;
      return;
    }

    console.log("Extraction (not saved)");
    console.log(JSON.stringify(result.data, null, 2));
  } catch {
    console.error("Import did not finish. Check the ai.call log line for a code.");
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void main();
