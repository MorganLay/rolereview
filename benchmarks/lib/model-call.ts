/**
 * One TAILOR-task call that keeps the raw response.
 * Model, effort, and max tokens come from AI_TASKS.TAILOR.
 * runStructured does not return the raw text, and src/ stays unchanged.
 */
import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { getAnthropic } from "@/lib/ai/client";
import { AI_TASKS } from "@/lib/ai/models";
import { cacheWriteTokens, estimateCostMicros, tokenUsageFromApi, type TokenUsage } from "@/lib/ai/pricing";
import { db } from "@/lib/db";

export type SavedCall = {
  ok: boolean;
  code: string | null;
  data: unknown;
  raw: string;
  system: string;
  systemSha256: string;
  userMessage: string;
  model: string;
  effort: string;
  maxTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
};

export async function callTailor(input: {
  userId: string;
  system: string;
  userMessage: string;
  schema: z.ZodType;
  normalize?: (value: unknown) => unknown;
  refId: string;
  /** IMPORT uses the same Sonnet settings as TAILOR. The row records which prompt it was. */
  task?: "TAILOR" | "IMPORT";
}): Promise<SavedCall> {
  const taskName = input.task ?? "TAILOR";
  const task = AI_TASKS[taskName];
  const client = getAnthropic();
  const started = Date.now();
  let usage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
  };
  let raw = "";
  let ok = false;
  let code: string | null = "AI_FAILED";
  let data: unknown = null;

  try {
    const message = await client.messages.create({
      model: task.model,
      max_tokens: task.maxTokens,
      system: input.system,
      messages: [{ role: "user", content: [{ type: "text", text: input.userMessage }] }],
      output_config: {
        format: outputFormat(input.schema),
        effort: task.effort,
      },
    });
    usage = tokenUsageFromApi(message.usage);
    raw = outputText(message);
    const read = readJson(message.stop_reason, raw, input.schema, input.normalize);
    ok = read.ok;
    code = read.code;
    data = read.data;
  } catch (error) {
    ok = false;
    code = "AI_FAILED";
    const name = error instanceof Error ? error.name : "Error";
    const status = error && typeof error === "object" && "status" in error ? String(error.status) : "";
    console.info(JSON.stringify({ event: "bench.call_error", refId: input.refId, name, status }));
  }

  const costMicros = estimateCostMicros(task.model, usage);
  await db.aiCall.create({
    data: {
      userId: input.userId,
      kind: taskName,
      model: task.model,
      success: ok,
      errorCode: ok ? null : code,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: cacheWriteTokens(usage),
      durationMs: Date.now() - started,
      costMicros,
      refId: input.refId,
    },
  });
  console.info(
    JSON.stringify({
      event: "bench.call",
      refId: input.refId,
      code: ok ? null : code,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: costMicros / 1_000_000,
    }),
  );
  return {
    ok,
    code: ok ? null : code,
    data,
    raw,
    system: input.system,
    systemSha256: createHash("sha256").update(input.system).digest("hex"),
    userMessage: input.userMessage,
    model: task.model,
    effort: task.effort,
    maxTokens: task.maxTokens,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: cacheWriteTokens(usage),
    costUsd: costMicros / 1_000_000,
  };
}

function outputText(message: Anthropic.Message): string {
  for (const block of message.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

function readJson(
  stopReason: string | null,
  raw: string,
  schema: z.ZodType,
  normalize?: (value: unknown) => unknown,
): { ok: boolean; code: string | null; data: unknown } {
  if (stopReason === "refusal") return { ok: false, code: "AI_REFUSED", data: null };
  if (stopReason === "max_tokens") return { ok: false, code: "AI_TRUNCATED", data: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: "AI_FAILED", data: null };
  }
  const value = normalize ? safeNormalize(normalize, parsed) : parsed;
  const checked = schema.safeParse(value);
  if (!checked.success) return { ok: false, code: "AI_FAILED", data: null };
  return { ok: true, code: null, data: checked.data };
}

function safeNormalize(normalize: (value: unknown) => unknown, value: unknown): unknown {
  try {
    return normalize(value);
  } catch {
    return value;
  }
}

function outputFormat(schema: z.ZodType) {
  try {
    return zodOutputFormat(schema);
  } catch {
    const jsonSchema = z.toJSONSchema(schema);
    if (jsonSchema.type !== "object") throw new Error("AI output schema must be a JSON object.");
    return jsonSchemaOutputFormat(jsonSchema as Parameters<typeof jsonSchemaOutputFormat>[0]);
  }
}
