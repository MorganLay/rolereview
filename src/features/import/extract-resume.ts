import "server-only";

import { strings } from "@/copy/strings";
import { checkQuota } from "@/features/billing/quota";
import type { SessionUser } from "@/lib/auth";
import { buildContent, OutputSchema, SYSTEM } from "@/lib/ai/prompts/import";
import { runStructured } from "@/lib/ai/run";
import { fail, ok, type ActionFailure, type ActionResult } from "@/lib/result";

import {
  classifyUpload,
  extractDocxText,
  postProcessImport,
  textBounds,
  type ExtractedResume,
} from "./extract";
import { IMPORT_LIMITS, type ExtractRequest } from "./schemas";

const errors = strings.library.import.errors;

/**
 * Quota, file checks, then one IMPORT call. The library is not written.
 * A bad file returns VALIDATION before the quota check.
 */
export async function extractResumeForUser(
  user: Pick<SessionUser, "id" | "plan">,
  request: ExtractRequest,
): Promise<ActionResult<ExtractedResume>> {
  const prepared = await prepareContent(request);
  if (!prepared.ok) return prepared.result;

  const quota = await checkQuota(user, "IMPORT");
  if (!quota.allowed) return fail("QUOTA_EXCEEDED");

  const result = await runStructured({
    kind: "IMPORT",
    userId: user.id,
    usedBonusCredit: quota.useBonus,
    system: SYSTEM,
    content: prepared.content,
    schema: OutputSchema,
  });
  if (!result.ok) return fail("AI_FAILED");
  return ok(postProcessImport(result.data));
}

async function prepareContent(request: ExtractRequest): Promise<
  | { ok: true; content: ReturnType<typeof buildContent> }
  | { ok: false; result: ActionFailure }
> {
  if (request.source === "text") {
    const text = request.text.trim();
    const bounds = textBounds(text);
    if (bounds === "short") {
      return { ok: false, result: fail("VALIDATION", { text: [errors.textShort] }) };
    }
    if (bounds === "long") {
      return { ok: false, result: fail("VALIDATION", { text: [errors.textLong] }) };
    }
    return { ok: true, content: buildContent({ kind: "text", text }) };
  }

  if (request.file.size === 0) {
    return { ok: false, result: fail("VALIDATION", { file: [errors.empty] }) };
  }
  if (request.file.size > IMPORT_LIMITS.fileBytes) {
    return { ok: false, result: fail("VALIDATION", { file: [errors.fileSize] }) };
  }

  const bytes = new Uint8Array(await request.file.arrayBuffer());
  const classified = classifyUpload(bytes, request.file.type);
  if (!classified.ok) {
    const message =
      classified.reason === "too_large"
        ? errors.fileSize
        : classified.reason === "empty"
          ? errors.empty
          : errors.fileType;
    return { ok: false, result: fail("VALIDATION", { file: [message] }) };
  }

  if (classified.kind === "pdf") {
    return {
      ok: true,
      content: buildContent({
        kind: "pdf",
        base64: Buffer.from(bytes).toString("base64"),
      }),
    };
  }

  const docxText = await extractDocxText(bytes);
  if (docxText === null) {
    return { ok: false, result: fail("VALIDATION", { file: [errors.unreadable] }) };
  }
  const text = docxText.trim();
  const bounds = textBounds(text);
  if (bounds === "short") {
    return { ok: false, result: fail("VALIDATION", { file: [errors.textShort] }) };
  }
  if (bounds === "long") {
    return { ok: false, result: fail("VALIDATION", { file: [errors.textLong] }) };
  }
  return { ok: true, content: buildContent({ kind: "text", text }) };
}
