"use server";

import { headers } from "next/headers";

import { postProcessAnalyze } from "@/features/jobs/analyze";
import { keywordCoverageFromText } from "@/features/tailor/keywords";
import { captureServerEvent } from "@/lib/analytics";
import { SYSTEM, buildContent, OutputSchema } from "@/lib/ai/prompts/analyze";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { clientIpForLimit, hashClientIp } from "@/lib/iphash";
import { fail, ok, type ActionResult } from "@/lib/result";
import { verifyTurnstile } from "@/lib/turnstile";

import { reserveKeywordRun, settleKeywordRun } from "./reserve";
import { topMustHaveTexts } from "./limit";
import { checkKeywordSchema, type KeywordReport } from "./schemas";

export async function checkKeywordCoverage(
  input: unknown,
): Promise<ActionResult<KeywordReport>> {
  const parsed = checkKeywordSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const headerStore = await headers();
  const remoteIp = clientIpForLimit(headerStore, env.NODE_ENV);
  if (!remoteIp) return fail("RATE_LIMITED");

  const captchaOk = await verifyTurnstile(parsed.data.turnstileToken, remoteIp);
  if (!captchaOk) return fail("CAPTCHA_FAILED");

  const ipHash = hashClientIp(remoteIp);
  if (!ipHash) return fail("INTERNAL");

  const reserved = await reserveKeywordRun(ipHash);
  if (!reserved.ok) return fail("RATE_LIMITED");

  const result = await runStructured({
    kind: "FREE_TOOL",
    userId: null,
    system: SYSTEM,
    content: buildContent(parsed.data.posting),
    schema: OutputSchema,
    refId: reserved.id,
  });

  const call = await db.aiCall.findFirst({
    where: { kind: "FREE_TOOL", refId: reserved.id },
    select: { inputTokens: true, outputTokens: true },
  });

  await settleKeywordRun(reserved.id, {
    success: result.ok,
    inputTokens: call?.inputTokens ?? 0,
    outputTokens: call?.outputTokens ?? 0,
  });

  if (!result.ok) return fail("AI_FAILED");

  let analysis;
  try {
    analysis = postProcessAnalyze(result.data, parsed.data.posting);
  } catch {
    return fail("AI_FAILED");
  }

  const coverage = keywordCoverageFromText(parsed.data.resume, analysis.keywords);

  await captureServerEvent(ipHash, "tool_run", { tool: "keyword-checker" });

  return ok({
    coveragePct: coverage.pct,
    covered: coverage.covered,
    missing: coverage.missing,
    mustHaves: topMustHaveTexts(analysis.requirements),
  });
}
