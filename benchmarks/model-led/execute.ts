/**
 * Paid arm C. Loaded only after the spending gate. It does not write a resume row.
 * Arms A and B stay on the existing paid command, with the same case ids.
 */
import "dotenv/config";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { runStructured } from "@/lib/ai/run";
import { normalizeTailorOutput, OutputSchema } from "@/lib/ai/prompts/tailor";
import type { JobAnalysis } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { pageCeiling, type ResumeContent, type TailorOutput } from "@/features/tailor/schemas";

import { prepareEvidence } from "../lib/evidence";
import { loadCase } from "../lib/load";
import { careerLibraryInput } from "./library";
import { buildModelLedResume } from "./pipeline";
import { MODEL_LED_ID, modelLedPrompt, modelLedUserMessage } from "./prompt";

const CALL_RESERVE_USD = 0.35;

export async function runModelLedCases(input: { caseIds: string[]; maxUsd: number }): Promise<void> {
  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY. No request was sent.");
  if (!userId) throw new Error("Set SEED_USER_ID. No request was sent.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("No User row for SEED_USER_ID. No request was sent.");

  const runId = `model-led-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(process.cwd(), "benchmarks", "results", runId);
  mkdirSync(directory, { recursive: true });
  let spent = 0;
  const finished: string[] = [];

  for (const caseId of input.caseIds) {
    const testCase = loadCase(caseId);
    if (!testCase) throw new Error(`Unknown case ${caseId}. No further request was sent.`);
    if (spent + CALL_RESERVE_USD > input.maxUsd) {
      console.log(`Stopping. Spent $${spent.toFixed(4)}. The next call could pass $${input.maxUsd.toFixed(2)}.`);
      break;
    }
    const prepared = prepareEvidence(testCase);
    const evidence = prepared.evidence;
    const adapted = prepared.adapted;
    const library = careerLibraryInput(adapted.snapshot);
    if (!library.report.fitsBudget) {
      writeFileSync(
        path.join(directory, `${caseId}.trace.json`),
        JSON.stringify({ version: MODEL_LED_ID, skipped: library.report.note, calls: 0 }, null, 2),
      );
      console.log(`${caseId} skipped. ${library.report.note}`);
      continue;
    }
    const message = modelLedUserMessage({ snapshot: adapted.snapshot, job: evidence.job, length: "auto" });
    const analysis = bareAnalysis(evidence.job);
    const firstRef = `bench:${caseId}:model-led:${randomUUID()}`;
    const generated = await runStructured({
      kind: "TAILOR",
      userId,
      countsTowardQuota: false,
      system: modelLedPrompt(),
      content: [{ type: "text", text: message.text }],
      schema: OutputSchema,
      normalize: normalizeTailorOutput,
      refId: firstRef,
    });
    spent += await costOf(firstRef);
    if (!generated.ok) {
      writeFileSync(
        path.join(directory, `${caseId}.trace.json`),
        JSON.stringify({ version: MODEL_LED_ID, failed: generated.code, calls: 1 }, null, 2),
      );
      console.log(`${caseId} failed: ${generated.code}. Spent $${spent.toFixed(4)}.`);
      continue;
    }
    let calls = 1;
    let result = await buildModelLedResume({
      draft: generated.data,
      snapshot: adapted.snapshot,
      analysis,
      length: "auto",
      reviser:
        spent + CALL_RESERVE_USD <= input.maxUsd
          ? async (brief) => reviseOnce(caseId, userId, adapted.snapshot, evidence.job, brief, (usd) => {
              spent += usd;
            })
          : undefined,
    });
    if (result.revised) calls = 2;
    const counted = await countPages(directory, caseId, result.content, adapted.snapshot);
    if (
      counted !== null &&
      counted > pageCeiling("auto") &&
      !result.reasons.includes("page") &&
      spent + CALL_RESERVE_USD <= input.maxUsd
    ) {
      const shortened = await reviseOnce(
        caseId,
        userId,
        adapted.snapshot,
        evidence.job,
        `The rendered resume is ${counted} pages. The ceiling is ${pageCeiling("auto")}. Shorten it by dropping the least necessary support line. Do not drop the only evidence for a requirement. Do not change fonts, margins, or layout.`,
        (usd) => {
          spent += usd;
        },
      );
      if (shortened) {
        const again = await buildModelLedResume({
          draft: shortened,
          snapshot: adapted.snapshot,
          analysis,
          length: "auto",
        });
        result = { ...again, revised: true };
        calls += 1;
      }
    }
    writeFileSync(
      path.join(directory, `${caseId}.fit-input.json`),
      JSON.stringify({ role: { content: result.content, snapshot: adapted.snapshot }, baseline: null }),
    );
    writeFileSync(
      path.join(directory, `${caseId}.trace.json`),
      JSON.stringify({ ...result, content: undefined, calls }, null, 2),
    );
    finished.push(caseId);
    console.log(`${caseId} drafted. Spent $${spent.toFixed(4)}.`);
  }

  fitDirectory(directory);
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        runId,
        version: MODEL_LED_ID,
        status: "paid",
        spentUsd: spent,
        maxUsd: input.maxUsd,
        caseIds: finished,
        note: "Arm C only. Arms A and B are the existing paid command with these case ids. Phrase checks are not a score. Production resumes were not written.",
      },
      null,
      2,
    ),
  );
  console.log(`Saved benchmarks/results/${runId}. Total $${spent.toFixed(4)} of $${input.maxUsd.toFixed(2)}.`);
}

async function reviseOnce(
  caseId: string,
  userId: string,
  snapshot: LibrarySnapshot,
  job: string,
  brief: string,
  add: (usd: number) => void,
): Promise<TailorOutput | null> {
  const message = modelLedUserMessage({ snapshot, job, length: "auto", revision: brief });
  const refId = `bench:${caseId}:model-led-revision:${randomUUID()}`;
  const revised = await runStructured({
    kind: "TAILOR",
    userId,
    countsTowardQuota: false,
    system: modelLedPrompt(),
    content: [{ type: "text", text: message.text }],
    schema: OutputSchema,
    normalize: normalizeTailorOutput,
    refId,
  });
  add(await costOf(refId));
  return revised.ok ? revised.data : null;
}

async function costOf(refId: string): Promise<number> {
  const row = await db.aiCall.findFirst({
    where: { refId },
    orderBy: { createdAt: "desc" },
    select: { costMicros: true },
  });
  return (row?.costMicros ?? 0) / 1_000_000;
}

function bareAnalysis(job: string): JobAnalysis {
  const first = job.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "Role";
  return {
    title: first.slice(0, 120),
    company: "",
    location: null,
    seniority: "unknown",
    workMode: "UNKNOWN",
    employmentType: null,
    salary: null,
    referenceNumber: null,
    summary: "",
    requirements: [],
    keywords: [],
  };
}

async function countPages(
  directory: string,
  caseId: string,
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): Promise<number | null> {
  writeFileSync(
    path.join(directory, `${caseId}.fit-input.json`),
    JSON.stringify({ role: { content, snapshot }, baseline: null }),
  );
  if (!spawnFit(directory, "count")) return null;
  const saved = JSON.parse(readFit(directory, caseId)) as { role?: { pages?: number | null } };
  return typeof saved.role?.pages === "number" ? saved.role.pages : null;
}

function readFit(directory: string, caseId: string): string {
  return readFileSync(path.join(directory, `${caseId}.fitted.json`), "utf8");
}

function fitDirectory(directory: string): void {
  if (!spawnFit(directory, "fit")) console.error("Page fit did not complete.");
}

function spawnFit(directory: string, mode: "count" | "fit"): boolean {
  const ran = spawnSync("npx", ["vitest", "run", "tests/unit/benchmark-fit-saved.test.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, BENCHMARK_FIT_DIR: directory, BENCHMARK_FIT_MODE: mode },
    shell: true,
    encoding: "utf8",
  });
  if (ran.status !== 0) console.error(ran.stderr || ran.stdout || "Page measurement did not complete.");
  return ran.status === 0;
}
