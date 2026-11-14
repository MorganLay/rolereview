/**
 * Paid outcome-first and write-then-verify drafts, then free replays.
 * Revision is off. One fix call is allowed only for a flagged O-C or W-C resume.
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { normalizeTailorOutput, OutputSchema } from "@/lib/ai/prompts/tailor";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { TailorOutput } from "@/features/tailor/schemas";

import { prepareEvidence } from "../lib/evidence";
import { callTailor, type SavedCall } from "../lib/model-call";
import { loadCase } from "../lib/load";
import { baselineDocument } from "../lib/plain-resume";
import { modelLedPrompt, modelLedUserMessage } from "../model-led/prompt";
import { EXPERIMENT_CASES } from "./estimate";
import { markdownTable, measureDirectory } from "./measure";
import {
  FixSchema,
  fixMessage,
  fixPrompt,
  normalizeWriteDraft,
  writeDraftToTailor,
  WriteSchema,
  writeVerifyMessage,
  writeVerifyPrompt,
} from "./prompt";
import { applyReplacements, bareAnalysis, dropFlagged, flagRecords, replayDraft } from "./replay";

const DIRECT_RUN = path.join(process.cwd(), "benchmarks", "results", "paid-2026-11-13T16-11-06-576Z");
const RESERVE_USD = 0.2;

type ArmName = "O" | "W";

export async function runExperiment(input: { maxUsd: number }): Promise<void> {
  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY. No request was sent.");
  if (!userId) throw new Error("Set SEED_USER_ID. No request was sent.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("No User row for SEED_USER_ID. No request was sent.");

  const runId = `write-verify-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(process.cwd(), "benchmarks", "results", runId);
  mkdirSync(directory, { recursive: false });
  let spent = 0;
  const calls: { caseId: string; arm: string; costUsd: number }[] = [];

  const allow = (label: string) => {
    if (spent + RESERVE_USD > input.maxUsd) {
      throw new Error(`Stopping before ${label}. Spent $${spent.toFixed(4)}. The next call could pass $${input.maxUsd.toFixed(2)}.`);
    }
  };

  const drafts = new Map<string, { arm: ArmName; draft: TailorOutput; originalBullets: string[] }>();

  for (const caseId of EXPERIMENT_CASES) {
    allow(`${caseId} outcome-first`);
    const saved = await draftOutcome(caseId, userId);
    spent += saved.call.costUsd;
    calls.push({ caseId, arm: "O", costUsd: saved.call.costUsd });
    writeFileSync(path.join(directory, `${caseId}.O.call.json`), JSON.stringify(saved.call, null, 2));
    if (saved.draft) {
      drafts.set(`${caseId}.O`, {
        arm: "O",
        draft: saved.draft,
        originalBullets: saved.draft.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)),
      });
    }
    console.log(`${caseId} O $${saved.call.costUsd.toFixed(4)}. Total $${spent.toFixed(4)}.`);
  }

  for (const caseId of EXPERIMENT_CASES) {
    allow(`${caseId} write-verify`);
    const saved = await draftWrite(caseId, userId);
    spent += saved.call.costUsd;
    calls.push({ caseId, arm: "W", costUsd: saved.call.costUsd });
    writeFileSync(path.join(directory, `${caseId}.W.call.json`), JSON.stringify(saved.call, null, 2));
    if (saved.draft) {
      drafts.set(`${caseId}.W`, {
        arm: "W",
        draft: saved.draft,
        originalBullets: saved.draft.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)),
      });
    }
    console.log(`${caseId} W $${saved.call.costUsd.toFixed(4)}. Total $${spent.toFixed(4)}.`);
  }

  const prepared = new Map(EXPERIMENT_CASES.map((caseId) => [caseId, prepareCase(caseId)]));
  const checkedDrafts = new Map(drafts);

  for (const caseId of EXPERIMENT_CASES) {
    const ready = prepared.get(caseId);
    if (!ready) continue;
    for (const arm of ["O", "W"] as const) {
      const held = drafts.get(`${caseId}.${arm}`);
      if (!held) continue;
      const replay = replayDraft({ draft: held.draft, snapshot: ready.snapshot, analysis: ready.analysis, mode: "C" });
      if (replay.flags.length === 0) continue;
      if (spent + RESERVE_USD > input.maxUsd) {
        console.log(`No fix call for ${caseId} ${arm}. Spent $${spent.toFixed(4)}.`);
        continue;
      }
      const records = flagRecords(held.draft, replay.flags, ready.snapshot);
      writeFileSync(
        path.join(directory, `${caseId}.${arm}.fix-before.json`),
        JSON.stringify({ flags: replay.flags, lines: records }, null, 2),
      );
      const fixed = await callTailor({
        userId,
        system: fixPrompt(),
        userMessage: fixMessage({ flags: records }),
        schema: FixSchema,
        refId: `bench:${caseId}:${arm}:fix:${randomUUID()}`,
      });
      spent += fixed.costUsd;
      calls.push({ caseId, arm: `${arm}-fix`, costUsd: fixed.costUsd });
      writeFileSync(path.join(directory, `${caseId}.${arm}.fix.call.json`), JSON.stringify(fixed, null, 2));
      const replacements = fixed.ok ? FixSchema.safeParse(fixed.data).data?.replacements ?? [] : [];
      const replaced = applyReplacements(held.draft, replacements);
      const again = replayDraft({ draft: replaced, snapshot: ready.snapshot, analysis: ready.analysis, mode: "C" });
      const dropped = dropFlagged(replaced, again.flags);
      writeFileSync(
        path.join(directory, `${caseId}.${arm}.fix-after.json`),
        JSON.stringify({ replacements, stillFlagged: again.flags, dropped: dropped.dropped }, null, 2),
      );
      checkedDrafts.set(`${caseId}.${arm}`, { ...held, draft: dropped.draft });
      console.log(`${caseId} ${arm} fix $${fixed.costUsd.toFixed(4)}. Total $${spent.toFixed(4)}.`);
    }
  }

  for (const caseId of EXPERIMENT_CASES) {
    const ready = prepared.get(caseId);
    if (!ready) continue;
    const outcome = drafts.get(`${caseId}.O`);
    const outcomeChecked = checkedDrafts.get(`${caseId}.O`);
    const written = checkedDrafts.get(`${caseId}.W`);
    if (outcome && outcomeChecked) {
      writeReplay(directory, caseId, "O-A", outcome.draft, outcome.originalBullets, ready, "A");
      writeReplay(directory, caseId, "O-B", outcome.draft, outcome.originalBullets, ready, "B");
      writeReplay(directory, caseId, "O-C", outcomeChecked.draft, outcome.originalBullets, ready, "C");
    }
    if (written) writeReplay(directory, caseId, "W-C", written.draft, written.originalBullets, ready, "C");
    writeDirect(directory, caseId);
  }

  fitDirectory(directory);
  const measured = measureDirectory(directory, [...EXPERIMENT_CASES]);
  writeFileSync(path.join(directory, "metrics.json"), JSON.stringify(measured, null, 2));
  writeFileSync(path.join(directory, "metrics.md"), markdownTable(measured));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        runId,
        status: "paid",
        spentUsd: spent,
        maxUsd: input.maxUsd,
        calls,
        directRun: "paid-2026-11-13T16-11-06-576Z",
        note: "Outcome-first revision is off. Write-then-verify is one draft. Fix calls ran only for flagged O-C and W-C resumes. Production resumes were not written.",
      },
      null,
      2,
    ),
  );
  console.log(`Saved benchmarks/results/${runId}. Total $${spent.toFixed(4)} of $${input.maxUsd.toFixed(2)}.`);
}

async function draftOutcome(caseId: string, userId: string): Promise<{ call: SavedCall; draft: TailorOutput | null }> {
  const ready = prepareCase(caseId);
  const message = modelLedUserMessage({ snapshot: ready.snapshot, job: ready.job, length: "auto" });
  const call = await callTailor({
    userId,
    system: modelLedPrompt(),
    userMessage: message.text,
    schema: OutputSchema,
    normalize: normalizeTailorOutput,
    refId: `bench:${caseId}:outcome:${randomUUID()}`,
  });
  if (!call.ok) return { call, draft: null };
  const parsed = OutputSchema.safeParse(call.data);
  return { call, draft: parsed.success ? (parsed.data as TailorOutput) : null };
}

async function draftWrite(caseId: string, userId: string): Promise<{ call: SavedCall; draft: TailorOutput | null }> {
  const ready = prepareCase(caseId);
  const message = writeVerifyMessage(ready.snapshot, ready.job);
  const call = await callTailor({
    userId,
    system: writeVerifyPrompt(),
    userMessage: message.text,
    schema: WriteSchema,
    normalize: normalizeWriteDraft,
    refId: `bench:${caseId}:write:${randomUUID()}`,
  });
  if (!call.ok) return { call, draft: null };
  const parsed = WriteSchema.safeParse(call.data);
  return { call, draft: parsed.success ? writeDraftToTailor(parsed.data) : null };
}

function prepareCase(caseId: string): {
  snapshot: ReturnType<typeof prepareEvidence>["adapted"]["snapshot"];
  job: string;
  analysis: ReturnType<typeof bareAnalysis>;
} {
  const testCase = loadCase(caseId);
  if (!testCase) throw new Error(`Unknown case ${caseId}.`);
  const prepared = prepareEvidence(testCase);
  return { snapshot: prepared.adapted.snapshot, job: prepared.evidence.job, analysis: bareAnalysis(prepared.evidence.job) };
}

function writeReplay(
  directory: string,
  caseId: string,
  variant: string,
  draft: TailorOutput,
  originalBullets: string[],
  ready: { snapshot: ReturnType<typeof prepareEvidence>["adapted"]["snapshot"]; analysis: ReturnType<typeof bareAnalysis> },
  mode: "A" | "B" | "C",
): void {
  const replay = replayDraft({ draft, snapshot: ready.snapshot, analysis: ready.analysis, mode });
  writeFileSync(
    path.join(directory, `${caseId}.${variant}.replay.json`),
    JSON.stringify({ ...replay, content: undefined, draftBullets: originalBullets }, null, 2),
  );
  writeFileSync(
    path.join(directory, `${caseId}.${variant}.fit-input.json`),
    JSON.stringify({ role: { content: replay.content, snapshot: ready.snapshot }, baseline: null }),
  );
}

function writeDirect(directory: string, caseId: string): void {
  const trace = JSON.parse(readFileSync(path.join(DIRECT_RUN, `${caseId}.trace.json`), "utf8")) as {
    composedText?: { baseline?: string };
  };
  const raw = trace.composedText?.baseline ?? "";
  const document = baselineDocument(raw);
  const bullets = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-+\s*/, ""));
  writeFileSync(
    path.join(directory, `${caseId}.direct.replay.json`),
    JSON.stringify({ flags: [], draftBullets: bullets, issues: [], reverts: 0 }, null, 2),
  );
  writeFileSync(
    path.join(directory, `${caseId}.direct.fit-input.json`),
    JSON.stringify({ role: { content: document.content, snapshot: document.snapshot }, baseline: null }),
  );
}

function fitDirectory(directory: string): void {
  const ran = spawnSync("npx", ["vitest", "run", "tests/unit/benchmark-fit-saved.test.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, BENCHMARK_FIT_DIR: directory, BENCHMARK_WRITE_PDF: "1" },
    shell: true,
    encoding: "utf8",
  });
  if (ran.status !== 0) console.error(ran.stderr || ran.stdout || "Page fit did not complete.");
}
