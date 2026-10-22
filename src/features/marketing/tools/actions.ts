"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

import { postProcessAnalyze } from "@/features/jobs/analyze";
import { keywordCoverageFromText } from "@/features/tailor/keywords";
import { captureServerEvent } from "@/lib/analytics";
import { SYSTEM, buildContent, OutputSchema } from "@/lib/ai/prompts/analyze";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";
import { clientIpFromHeaders, hashClientIp } from "@/lib/iphash";
import { fail, ok, type ActionResult } from "@/lib/result";
import { verifyTurnstile } from "@/lib/turnstile";

import { isKeywordCheckerLimited, topMustHaveTexts } from "./limit";
import { checkKeywordSchema, type KeywordReport } from "./schemas";

export async function checkKeywordCoverage(
  input: unknown,
): Promise<ActionResult<KeywordReport>> {
  const parsed = checkKeywordSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const headerStore = await headers();
  const remoteIp = clientIpFromHeaders(headerStore);
  if (!remoteIp) return fail("RATE_LIMITED");

  const captchaOk = await verifyTurnstile(parsed.data.turnstileToken, remoteIp);
  if (!captchaOk) return fail("CAPTCHA_FAILED");

  const ipHash = hashClientIp(remoteIp);
  if (!ipHash) return fail("INTERNAL");

  const runCount = await db.freeToolRun.count({
    where: { ipHash, tool: "KEYWORD_CHECKER" },
  });
  if (isKeywordCheckerLimited(runCount)) return fail("RATE_LIMITED");

  const runId = randomUUID();
  const result = await runStructured({
    kind: "FREE_TOOL",
    userId: null,
    system: SYSTEM,
    content: buildContent(parsed.data.posting),
    schema: OutputSchema,
    refId: runId,
  });

  const call = await db.aiCall.findFirst({
    where: { kind: "FREE_TOOL", refId: runId },
    select: { inputTokens: true, outputTokens: true },
  });

  await db.freeToolRun.create({
    data: {
      tool: "KEYWORD_CHECKER",
      ipHash,
      success: result.ok,
      inputTokens: call?.inputTokens ?? 0,
      outputTokens: call?.outputTokens ?? 0,
    },
  });

  if (!result.ok) return fail("AI_FAILED");

  let analysis;
  try {
    analysis = postProcessAnalyze(result.data);
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
