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
  refId?: string;
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
  let status: number | null = null;
  let errorType: string | null = null;

  try {
    const message = await client.messages.parse({
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
    outcome = classify(message.stop_reason, message.parsed_output, args.schema);
  } catch (error) {
    outcome = { ok: false, code: "AI_FAILED" };
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

function classify<S extends z.ZodType>(
  stopReason: string | null,
  parsedOutput: unknown,
  schema: S,
): RunResult<z.infer<S>> {
  if (stopReason === "refusal") return { ok: false, code: "AI_REFUSED" };
  if (stopReason === "max_tokens") return { ok: false, code: "AI_TRUNCATED" };
  const parsed = schema.safeParse(parsedOutput);
  if (!parsed.success) return { ok: false, code: "AI_FAILED" };
  return { ok: true, data: parsed.data };
}

async function recordCall<T>(
  args: RunArgs<z.ZodType>,
  model: string,
  outcome: RunResult<T>,
  usage: TokenUsage,
  durationMs: number,
): Promise<void> {
  const success = outcome.ok;
  const wantsBonus = success && args.usedBonusCredit === true && args.userId !== null;
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
