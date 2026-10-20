"use server";

import { strings } from "@/copy/strings";
import { requireUserForAction } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/result";

import { zodFieldErrors } from "../library/schemas";

import type { ExtractedResume } from "./extract";
import { extractResumeForUser } from "./extract-resume";
import { coerceExtractInput, extractResumeSchema } from "./schemas";

const errors = strings.library.import.errors;

/** Read a resume into a review payload. Nothing is saved. */
export async function extractResume(
  input: unknown,
): Promise<ActionResult<ExtractedResume>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = extractResumeSchema.safeParse(coerceExtractInput(input));
  if (!parsed.success) {
    const fields = zodFieldErrors(parsed.error);
    if (Object.keys(fields).length === 0) {
      return fail("VALIDATION", { file: [errors.fileType] });
    }
    return fail("VALIDATION", fields);
  }

  return extractResumeForUser(user, parsed.data);
}
