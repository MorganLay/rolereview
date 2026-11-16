/**
 * On-demand live eval for job questions.
 * Does not send a request unless --confirm-spend and --max-usd are set,
 * and the estimate is within the cap. Same gate as the benchmark.
 * Writes each case under evals/out/questions/<timestamp>/.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { authorizeSpend } from "../../benchmarks/lib/cost";
import { QUESTION_CASES } from "./cases";
import { selectJobQuestions } from "@/features/questions/filter";
import { topicKey } from "@/features/questions/topic-key";
import {
  buildQuestions,
  QUESTIONS_SYSTEM,
  QuestionsSchema,
} from "@/lib/ai/prompts/job-questions";
import { db } from "@/lib/db";
import { runStructured } from "@/lib/ai/run";
import { env } from "@/lib/env";

const CASE_USD = 0.08;

function args(argv: string[]): { confirmSpend: boolean; maxUsd: number | null } {
  let confirmSpend = false;
  let maxUsd: number | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--confirm-spend") confirmSpend = true;
    else if (token === "--max-usd") {
      const value = Number(argv[index + 1]);
      maxUsd = Number.isFinite(value) ? value : null;
      index += 1;
    }
  }
  return { confirmSpend, maxUsd };
}

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "-",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join("");
}

function usd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

async function main(): Promise<void> {
  const estimatedUsd = QUESTION_CASES.length * CASE_USD;
  const gate = authorizeSpend({ ...args(process.argv.slice(2)), estimatedUsd });
  if (!gate.ok) {
    console.log(gate.reason);
    console.log(`Estimated $${estimatedUsd.toFixed(2)} for ${QUESTION_CASES.length} question calls. No request was sent.`);
    process.exit(0);
  }
  if (!env.SEED_USER_ID) {
    console.log("SEED_USER_ID is unset. No request was sent.");
    process.exit(1);
  }

  const directory = path.join("evals", "out", "questions", stamp());
  mkdirSync(directory, { recursive: true });
  let totalMicros = 0;
  const rows: {
    id: string;
    rawCount: number;
    keptCount: number;
    costMicros: number;
    inputTokens: number;
    outputTokens: number;
  }[] = [];

  console.log("case | raw | kept | cost | input | output");
  for (const item of QUESTION_CASES) {
    const known = new Set(item.known.map((topic) => topicKey(topic.subject, topic.entryId)));
    const result = await runStructured({
      kind: "JOB_QUESTIONS",
      userId: env.SEED_USER_ID,
      countsTowardQuota: false,
      system: QUESTIONS_SYSTEM,
      content: buildQuestions({
        libraryText: item.libraryText,
        requirements: item.requirements,
        posting: item.postingText,
        topics: item.known.map((topic) => ({
          topicKey: topicKey(topic.subject, topic.entryId),
          question: topic.subject,
          declined: true,
        })),
      }),
      schema: QuestionsSchema,
      refId: item.id,
    });
    if (!result.ok) {
      console.log(`${item.id} | failed | ${result.code}`);
      writeFileSync(
        path.join(directory, `${item.id}.json`),
        JSON.stringify({ id: item.id, ok: false, code: result.code }, null, 2),
      );
      continue;
    }
    const recorded = await db.aiCall.findFirst({
      where: { userId: env.SEED_USER_ID, kind: "JOB_QUESTIONS", refId: item.id },
      orderBy: { createdAt: "desc" },
      select: {
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
        costMicros: true,
        model: true,
      },
    });
    const costMicros = recorded?.costMicros ?? 0;
    totalMicros += costMicros;
    const kept = selectJobQuestions({
      proposed: result.data.questions,
      requirements: item.requirements,
      entries: item.entries,
      libraryText: item.libraryText,
      postingText: item.postingText,
      knownTopicKeys: known,
    });
    const record = {
      id: item.id,
      model: recorded?.model ?? null,
      inputTokens: recorded?.inputTokens ?? 0,
      outputTokens: recorded?.outputTokens ?? 0,
      cacheReadTokens: recorded?.cacheReadTokens ?? 0,
      cacheWriteTokens: recorded?.cacheWriteTokens ?? 0,
      costMicros,
      costUsd: costMicros / 1_000_000,
      raw: result.data.questions,
      kept,
    };
    writeFileSync(path.join(directory, `${item.id}.json`), JSON.stringify(record, null, 2));
    rows.push({
      id: item.id,
      rawCount: result.data.questions.length,
      keptCount: kept.length,
      costMicros,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
    });
    console.log(
      `${item.id} | ${record.raw.length} | ${kept.length} | ${usd(costMicros)} | ${record.inputTokens} | ${record.outputTokens}`,
    );
  }

  writeFileSync(
    path.join(directory, "summary.json"),
    JSON.stringify(
      {
        totalCostMicros: totalMicros,
        totalCostUsd: totalMicros / 1_000_000,
        cases: rows,
      },
      null,
      2,
    ),
  );
  console.log(`Total actual spend ${usd(totalMicros)}`);
  console.log(`Wrote ${directory}`);
}

main().catch((error: unknown) => {
  console.error("question eval failed", { code: error instanceof Error ? error.name : "error" });
  process.exit(1);
});
