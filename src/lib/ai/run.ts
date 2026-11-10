import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { selectBonusCredit } from "@/features/billing/quota";
import { Prisma } from "@/generated/prisma/client";
import type { AiCallKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { getAnthropic } from "./client";
import { AI_TASKS } from "./models";
import {
  cacheWriteTokens,
  EMPTY_USAGE,
  estimateCostMicros,
  tokenUsageFromApi,
  type TokenUsage,
} from "./pricing";

/**
 * The only way to call the model. docs/05-AI.md → runStructured().
 * Every attempt writes an AiCall row. Failures do not consume quota or bonus credits.
 */

export type RunArgs<S extends z.ZodType> = {
  kind: AiCallKind;
  userId: string | null;
  usedBonusCredit?: boolean;
  system: string;
  content: Anthropic.ContentBlockParam[];
  schema: S;
  /** Repair a parsed object before the schema check. A throw here is a validation failure. */
  normalize?: (value: unknown) => unknown;
  refId?: string;
  /**
   * Follow-up calls for a resume already charged (repair, revision).
   * The row stays successful for cost, and it does not count as another allowance use.
   */
  countsTowardQuota?: boolean;
};

export type RunResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: "AI_FAILED" | "AI_REFUSED" | "AI_TRUNCATED" };

export async function runStructured<S extends z.ZodType>(
  args: RunArgs<S>,
): Promise<RunResult<z.infer<S>>> {
  if (args.userId === null && args.kind !== "FREE_TOOL") {
    throw new Error("userId is null only for FREE_TOOL.");
  }
  if (args.userId !== null && args.kind === "FREE_TOOL") {
    throw new Error("FREE_TOOL calls are anonymous.");
  }

  const task = AI_TASKS[args.kind];
  const client = getAnthropic();
  const started = Date.now();
  let usage: TokenUsage = EMPTY_USAGE;
  let outcome: RunResult<z.infer<S>>;
  let stage: "ok" | "provider" | "validation" = "provider";
  let issues: { path: string; code: string }[] = [];
  let status: number | null = null;
  let errorType: string | null = null;

  try {
    // create(), not parse(). The SDK parser throws away the message when one
    // field fails Zod, so a usable analysis was logged as a provider failure
    // with no tokens.
    const message = await client.messages.create({
      model: task.model,
      max_tokens: task.maxTokens,
      system: args.system,
      messages: [{ role: "user", content: args.content }],
      output_config: {
        format: outputFormat(args.schema),
        effort: task.effort,
      },
    });
    usage = tokenUsageFromApi(message.usage);
    const read = readStructured(
      message.stop_reason,
      outputText(message),
      args.schema,
      args.normalize,
    );
    outcome = read.outcome;
    stage = read.stage;
    issues = read.issues;
  } catch (error) {
    outcome = { ok: false, code: "AI_FAILED" };
    stage = "provider";
    status = httpStatus(error);
    errorType = apiErrorType(error);
  }

  const durationMs = Date.now() - started;
  await recordCall(args, task.model, outcome, usage, durationMs);
  console.info(
    JSON.stringify({
      event: "ai.call",
      kind: args.kind,
      userId: args.userId,
      refId: args.refId ?? null,
      code: outcome.ok ? null : outcome.code,
      stage,
      ...(issues.length === 0 ? {} : { issues }),
      ...(status === null ? {} : { status }),
      ...(errorType === null ? {} : { errorType }),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      durationMs,
    }),
  );
  return outcome;
}

function httpStatus(error: unknown): number | null {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return null;
}

function apiErrorType(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("error" in error)) return null;
  const body = error.error;
  if (!body || typeof body !== "object") return null;
  if (
    "error" in body &&
    body.error &&
    typeof body.error === "object" &&
    "type" in body.error &&
    typeof body.error.type === "string"
  ) {
    return body.error.type;
  }
  if ("type" in body && typeof body.type === "string" && body.type !== "error") {
    return body.type;
  }
  return null;
}

function outputFormat(schema: z.ZodType) {
  try {
    return zodOutputFormat(schema);
  } catch {
    const jsonSchema = z.toJSONSchema(schema);
    if (jsonSchema.type !== "object") {
      throw new Error("AI output schema must be a JSON object.");
    }
    return jsonSchemaOutputFormat(
      jsonSchema as Parameters<typeof jsonSchemaOutputFormat>[0],
    );
  }
}

function outputText(message: Anthropic.Message): string {
  for (const block of message.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

function readStructured<S extends z.ZodType>(
  stopReason: string | null,
  text: string,
  schema: S,
  normalize?: (value: unknown) => unknown,
): {
  outcome: RunResult<z.infer<S>>;
  stage: "ok" | "provider" | "validation";
  issues: { path: string; code: string }[];
} {
  if (stopReason === "refusal") {
    return { outcome: { ok: false, code: "AI_REFUSED" }, stage: "provider", issues: [] };
  }
  if (stopReason === "max_tokens") {
    return { outcome: { ok: false, code: "AI_TRUNCATED" }, stage: "validation", issues: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      outcome: { ok: false, code: "AI_FAILED" },
      stage: "validation",
      issues: [{ path: "$", code: "json" }],
    };
  }
  const value = applyNormalize(normalize, parsed);
  const checked = schema.safeParse(value);
  if (!checked.success) {
    return {
      outcome: { ok: false, code: "AI_FAILED" },
      stage: "validation",
      issues: checked.error.issues.slice(0, 8).map((issue) => ({
        path: issue.path.join(".") || "$",
        code: issue.code,
      })),
    };
  }
  return { outcome: { ok: true, data: checked.data }, stage: "ok", issues: [] };
}

function applyNormalize(
  normalize: ((value: unknown) => unknown) | undefined,
  value: unknown,
): unknown {
  if (!normalize) return value;
  try {
    return normalize(value);
  } catch {
    return value;
  }
}

async function recordCall<T>(
  args: RunArgs<z.ZodType>,
  model: string,
  outcome: RunResult<T>,
  usage: TokenUsage,
  durationMs: number,
): Promise<void> {
  const success = outcome.ok;
  const exempt = args.countsTowardQuota === false;
  const wantsBonus =
    success && !exempt && args.usedBonusCredit === true && args.userId !== null;
  const write = () =>
    db.$transaction(async (tx) => {
      let usedBonusCredit = false;
      if (wantsBonus && args.userId) {
        const now = new Date();
        const credits = await tx.bonusCredit.findMany({
          where: {
            userId: args.userId,
            kind: args.kind,
            remaining: { gt: 0 },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: { id: true, remaining: true, expiresAt: true, createdAt: true },
        });
        const picked = selectBonusCredit(credits, now);
        if (picked) {
          const updated = await tx.bonusCredit.updateMany({
            where: { id: picked.id, userId: args.userId, remaining: { gt: 0 } },
            data: { remaining: { decrement: 1 } },
          });
          usedBonusCredit = updated.count === 1;
        }
        // No credit left to decrement (already spent, or lost a race).
        // Still mark the row so the call does not also consume the plan allowance.
        if (!usedBonusCredit) usedBonusCredit = true;
      }
      if (exempt) usedBonusCredit = true;
      await tx.aiCall.create({
        data: {
          userId: args.userId,
          kind: args.kind,
          model,
          success,
          errorCode: outcome.ok ? null : outcome.code,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: cacheWriteTokens(usage),
          durationMs,
          costMicros: estimateCostMicros(model, usage),
          refId: args.refId ?? null,
          usedBonusCredit,
        },
      });
    });

  try {
    await write();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2028"
    ) {
      await write();
      return;
    }
    throw error;
  }
}
