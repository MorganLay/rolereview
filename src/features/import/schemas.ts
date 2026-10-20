import { z } from "zod";

import { strings } from "@/copy/strings";

const errors = strings.library.import.errors;

/** Bounds from docs/05-AI.md → IMPORT, plus the library caps applied after the call. */
export const IMPORT_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  textMin: 200,
  textMax: 40_000,
  bulletHardMax: 2_000,
  email: 254,
  warningLength: 300,
  warningsMax: 20,
} as const;

export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const extractResumeSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("file"),
    file: z.instanceof(File, { error: errors.fileType }),
  }),
  z.object({
    source: z.literal("text"),
    text: z.string(),
  }),
]);

export type ExtractRequest = z.infer<typeof extractResumeSchema>;

/** FormData from the import form, or a plain object from tests and later UI. */
export function coerceExtractInput(input: unknown): unknown {
  if (typeof FormData === "undefined" || !(input instanceof FormData)) {
    return input;
  }
  const file = input.get("file");
  const text = input.get("text");
  if (file instanceof File && file.size > 0) {
    return { source: "file", file };
  }
  if (typeof text === "string") {
    return { source: "text", text };
  }
  if (file instanceof File) {
    return { source: "file", file };
  }
  return input;
}
