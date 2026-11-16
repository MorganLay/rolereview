/**
 * W2: one revised write-then-verify draft, one coverage call, one fix call.
 * The saved W drafts are replayed through the new harness with no model call.
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { TailorOutput } from "@/features/tailor/schemas";

import { blindAssignment } from "../lib/blind";
import { prepareEvidence } from "../lib/evidence";
import { callTailor, type SavedCall } from "../lib/model-call";
import { loadCase } from "../lib/load";
import { phraseMatch } from "../lib/phrases";
import { EXPERIMENT_CASES } from "./estimate";
import { applyCoverage, coverageGaps, draftPage } from "./coverage";
import { defectCounts, loadMustKeep, mustKeepScore } from "./must-keep";
import {
  CoverageSchema,
  coverageMessage,
  coveragePrompt,
  FixSchema,
  fixMessage,
  fixPrompt,
  normalizeWriteDraft,
  writeDraftToTailor,
  WriteSchema,
  writeVerifyMessage,
  writeVerifyPrompt,
} from "./prompt";
import { applyReplacements, bareAnalysis, dropFlagged, flagRecords, moveWrongEntry, remapSavedDraft, replayDraft } from "./replay";

const DIRECT_RUN = path.join(process.cwd(), "benchmarks", "results", "write-verify-2026-11-14T20-13-44-346Z");
const RESERVE_USD = 0.08;

type Ready = ReturnType<typeof prepareCase>;

export async function runW2(input: { maxUsd: number }): Promise<void> {
  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY. No request was sent.");
  if (!userId) throw new Error("Set SEED_USER_ID. No request was sent.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("No User row for SEED_USER_ID. No request was sent.");

  const runId = `write-verify-w2-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(process.cwd(), "benchmarks", "results", runId);
  mkdirSync(directory, { recursive: false });
  let spent = 0;
  const calls: { caseId: string; arm: string; costUsd: number }[] = [];
  const allow = (label: string) => {
    if (spent + RESERVE_USD > input.maxUsd) {
      throw new Error(`Stopping before ${label}. Spent $${spent.toFixed(4)}. The next call could pass $${input.maxUsd.toFixed(2)}.`);
    }
  };

  const prepared = new Map(EXPERIMENT_CASES.map((caseId) => [caseId, prepareCase(caseId)]));

  for (const caseId of EXPERIMENT_CASES) {
    const ready = prepared.get(caseId);
    if (!ready) continue;
    allow(`${caseId} draft`);
    const drafted = await draftW2(caseId, userId, ready);
    spent += drafted.call.costUsd;
    calls.push({ caseId, arm: "W2", costUsd: drafted.call.costUsd });
    writeFileSync(path.join(directory, `${caseId}.W2.call.json`), JSON.stringify(drafted.call, null, 2));
    console.log(`${caseId} W2 $${drafted.call.costUsd.toFixed(4)}. Total $${spent.toFixed(4)}.`);
    if (!drafted.draft) continue;

    let draft = drafted.draft;
    const gaps = coverageGaps(ready.snapshot, draftPage(draft, ready.snapshot));
    writeFileSync(path.join(directory, `${caseId}.W2.coverage-list.json`), JSON.stringify(gaps, null, 2));
    if (gaps.length > 0) {
      allow(`${caseId} coverage`);
      const covered = await callTailor({
        userId,
        system: coveragePrompt(),
        userMessage: coverageMessage({ draft: JSON.stringify(draftSummary(draft)), gaps, job: ready.job }),
        schema: CoverageSchema,
        refId: `bench:${caseId}:w2:coverage:${randomUUID()}`,
      });
      spent += covered.costUsd;
      calls.push({ caseId, arm: "W2-coverage", costUsd: covered.costUsd });
      writeFileSync(path.join(directory, `${caseId}.W2.coverage.call.json`), JSON.stringify(covered, null, 2));
      const decisions = covered.ok ? CoverageSchema.safeParse(covered.data).data?.decisions ?? [] : [];
      writeFileSync(path.join(directory, `${caseId}.W2.coverage-decisions.json`), JSON.stringify(decisions, null, 2));
      draft = applyCoverage(draft, decisions);
      console.log(`${caseId} coverage $${covered.costUsd.toFixed(4)}. Total $${spent.toFixed(4)}.`);
    }

    const checked = await verifyDraft({
      draft,
      ready,
      userId,
      caseId,
      directory,
      spent,
      maxUsd: input.maxUsd,
      allowModel: true,
    });
    spent = checked.spent;
    calls.push(...checked.calls);
    writeVariant(directory, caseId, "W2", checked.draft, ready);
  }

  for (const caseId of EXPERIMENT_CASES) {
    const ready = prepared.get(caseId);
    if (!ready) continue;
    const saved = savedWriteDraft(caseId, ready.snapshot);
    if (saved) {
      const replayed = await verifyDraft({
        draft: saved,
        ready,
        userId,
        caseId,
        directory,
        spent,
        maxUsd: input.maxUsd,
        allowModel: false,
      });
      writeVariant(directory, caseId, "W-replay", replayed.draft, ready);
    }
    writeDirect(directory, caseId);
  }

  fitDirectory(directory);
  writeBlind(directory, runId);
  const report = scoreDirectory(directory);
  writeFileSync(path.join(directory, "metrics.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify({ runId, status: "paid", spentUsd: spent, maxUsd: input.maxUsd, calls, directRun: DIRECT_RUN }, null, 2),
  );
  console.log(`Saved benchmarks/results/${runId}. Total $${spent.toFixed(4)} of $${input.maxUsd.toFixed(2)}.`);
}

async function verifyDraft(input: {
  draft: TailorOutput;
  ready: Ready;
  userId: string;
  caseId: string;
  directory: string;
  spent: number;
  maxUsd: number;
  allowModel: boolean;
}): Promise<{ draft: TailorOutput; spent: number; calls: { caseId: string; arm: string; costUsd: number }[] }> {
  const calls: { caseId: string; arm: string; costUsd: number }[] = [];
  let spent = input.spent;
  const first = replayDraft({ draft: input.draft, snapshot: input.ready.snapshot, analysis: input.ready.analysis, mode: "C" });
  const moved = moveWrongEntry(input.draft, first.flags);
  const draft = moved.draft;
  const afterMove = replayDraft({ draft, snapshot: input.ready.snapshot, analysis: input.ready.analysis, mode: "C" });
  const fixable = afterMove.flags.filter((flag) => flag.code !== "wrong-entry");
  if (fixable.length === 0 || !input.allowModel) {
    const dropped = dropFlagged(draft, fixable);
    if (!input.allowModel) {
      writeFileSync(
        path.join(input.directory, `${input.caseId}.W-replay.flags.json`),
        JSON.stringify({ moved: moved.moved, dropped: dropped.dropped }, null, 2),
      );
    }
    return { draft: dropped.draft, spent, calls };
  }
  if (spent + RESERVE_USD > input.maxUsd) {
    console.log(`No fix call for ${input.caseId}. Spent $${spent.toFixed(4)}.`);
    return { draft, spent, calls };
  }
  const records = flagRecords(draft, fixable, input.ready.snapshot);
  writeFileSync(path.join(input.directory, `${input.caseId}.W2.fix-before.json`), JSON.stringify({ flags: fixable, lines: records }, null, 2));
  const fixed = await callTailor({
    userId: input.userId,
    system: fixPrompt(),
    userMessage: fixMessage({ flags: records }),
    schema: FixSchema,
    refId: `bench:${input.caseId}:w2:fix:${randomUUID()}`,
  });
  spent += fixed.costUsd;
  calls.push({ caseId: input.caseId, arm: "W2-fix", costUsd: fixed.costUsd });
  writeFileSync(path.join(input.directory, `${input.caseId}.W2.fix.call.json`), JSON.stringify(fixed, null, 2));
  const replacements = fixed.ok ? FixSchema.safeParse(fixed.data).data?.replacements ?? [] : [];
  const replaced = applyReplacements(draft, replacements);
  const again = replayDraft({ draft: replaced, snapshot: input.ready.snapshot, analysis: input.ready.analysis, mode: "C" });
  const still = again.flags.filter((flag) => flag.code !== "wrong-entry");
  const dropped = dropFlagged(replaced, still);
  writeFileSync(
    path.join(input.directory, `${input.caseId}.W2.fix-after.json`),
    JSON.stringify({ replacements, stillFlagged: again.flags, dropped: dropped.dropped, moved: moved.moved }, null, 2),
  );
  console.log(`${input.caseId} fix $${fixed.costUsd.toFixed(4)}. Total $${spent.toFixed(4)}.`);
  return { draft: dropped.draft, spent, calls };
}

async function draftW2(
  caseId: string,
  userId: string,
  ready: Ready,
): Promise<{ call: SavedCall; draft: TailorOutput | null }> {
  const message = writeVerifyMessage(ready.snapshot, ready.job);
  const call = await callTailor({
    userId,
    system: writeVerifyPrompt(),
    userMessage: message.text,
    schema: WriteSchema,
    normalize: normalizeWriteDraft,
    refId: `bench:${caseId}:w2:${randomUUID()}`,
  });
  if (!call.ok) return { call, draft: null };
  const parsed = WriteSchema.safeParse(call.data);
  return { call, draft: parsed.success ? writeDraftToTailor(parsed.data) : null };
}

function prepareCase(caseId: string): {
  snapshot: ReturnType<typeof prepareEvidence>["adapted"]["snapshot"];
  job: string;
  analysis: ReturnType<typeof bareAnalysis>;
  libraryBullets: string[];
} {
  const testCase = loadCase(caseId);
  if (!testCase) throw new Error(`Unknown case ${caseId}.`);
  const prepared = prepareEvidence(testCase);
  const libraryBullets = prepared.adapted.snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
  return {
    snapshot: prepared.adapted.snapshot,
    job: prepared.evidence.job,
    analysis: bareAnalysis(prepared.evidence.job),
    libraryBullets,
  };
}

function writeVariant(directory: string, caseId: string, variant: string, draft: TailorOutput, ready: Ready): void {
  const replay = replayDraft({ draft, snapshot: ready.snapshot, analysis: ready.analysis, mode: "C" });
  writeFileSync(
    path.join(directory, `${caseId}.${variant}.replay.json`),
    JSON.stringify({ flags: replay.flags, reverts: replay.reverts, issues: replay.issues }, null, 2),
  );
  writeFileSync(
    path.join(directory, `${caseId}.${variant}.fit-input.json`),
    JSON.stringify({ role: { content: replay.content, snapshot: ready.snapshot }, baseline: null }),
  );
}

function writeDirect(directory: string, caseId: string): void {
  const fitted = readFileSync(path.join(DIRECT_RUN, `${caseId}.direct.fitted.json`), "utf8");
  const parsed = JSON.parse(fitted) as { role?: { text?: string } };
  writeFileSync(path.join(directory, `${caseId}.direct.fitted.json`), fitted);
  writeFileSync(path.join(directory, `${caseId}.direct.txt`), parsed.role?.text ?? "");
}

function savedWriteDraft(caseId: string, snapshot: Ready["snapshot"]): TailorOutput | null {
  const file = path.join(DIRECT_RUN, `${caseId}.W.call.json`);
  const saved = JSON.parse(readFileSync(file, "utf8")) as { data?: unknown; userMessage?: string };
  const parsed = WriteSchema.safeParse(saved.data);
  if (!parsed.success) return null;
  return remapSavedDraft(writeDraftToTailor(parsed.data), snapshot, saved.userMessage ?? "");
}

function draftSummary(draft: TailorOutput): unknown {
  return {
    headline: draft.plan?.headline ?? "",
    summary: draft.summary,
    entries: draft.entries.map((entry) => ({
      ref: entry.ref,
      lines: entry.bullets.map((bullet) => ({ text: bullet.text, refs: bullet.sourceRefs })),
    })),
    skills: draft.skills,
  };
}

function writeBlind(directory: string, runId: string): void {
  const blind = path.join(directory, "blind");
  mkdirSync(blind);
  const key = [];
  for (const caseId of EXPERIMENT_CASES) {
    const assignment = blindAssignment(caseId, runId);
    const folder = path.join(blind, caseId);
    mkdirSync(folder);
    const w2 = path.join(directory, `${caseId}.W2.pdf`);
    const direct = path.join(DIRECT_RUN, `${caseId}.direct.pdf`);
    const w2First = assignment.a === "roleRefine";
    copyFileSync(w2First ? w2 : direct, path.join(folder, "A.pdf"));
    copyFileSync(w2First ? direct : w2, path.join(folder, "B.pdf"));
    const [candidate, job] = caseId.split("-");
    copyFileSync(
      path.join(process.cwd(), "benchmarks", "fixtures", "jobs", `${job}.md`),
      path.join(folder, "posting.md"),
    );
    copyFileSync(
      path.join(process.cwd(), "benchmarks", "fixtures", "candidates", candidate ?? "", "original-resume.txt"),
      path.join(folder, "original-resume.txt"),
    );
    key.push({ caseId, A: w2First ? "W2" : "direct", B: w2First ? "direct" : "W2" });
  }
  writeFileSync(path.join(directory, "key.json"), JSON.stringify({ runId, cases: key }, null, 2));
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

function scoreDirectory(directory: string): unknown {
  const lists = loadMustKeep();
  const rows = [];
  for (const caseId of EXPERIMENT_CASES) {
    const ready = prepareCase(caseId);
    const testCase = loadCase(caseId);
    for (const variant of ["W2", "W-replay", "direct"] as const) {
      const fitted = readFitted(directory, caseId, variant);
      const items = lists[caseId] ?? [];
      const coverage = mustKeepScore(fitted.text, items);
      const defects = defectCounts(fitted.text, ready.libraryBullets);
      const avoid = (testCase?.avoidClaims ?? []).filter((phrase) => phraseMatch(fitted.text, phrase) !== "absent");
      rows.push({
        caseId,
        variant,
        ...coverage,
        rate: coverage.total === 0 ? 0 : coverage.kept / coverage.total,
        defects,
        avoid,
        bullets: bulletCount(fitted.text),
        medianWords: medianWords(fitted.text),
        words: wordCount(fitted.text),
        pages: fitted.pageLimit,
        fitterRemoved: fitted.dropped.length,
      });
    }
  }
  return { rows };
}

function readFitted(
  directory: string,
  caseId: string,
  variant: string,
): { text: string; pageLimit: number | null; dropped: string[] } {
  const file = path.join(directory, `${caseId}.${variant}.fitted.json`);
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    role?: { text?: string; pageLimit?: number | null; dropped?: string[] };
  };
  return {
    text: parsed.role?.text ?? "",
    pageLimit: parsed.role?.pageLimit ?? null,
    dropped: parsed.role?.dropped ?? [],
  };
}

function bulletCount(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().startsWith("- ")).length;
}

function medianWords(text: string): number {
  const counts = text
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("- "))
    .map((line) => line.trim().replace(/^-+\s*/, "").split(/\s+/).filter((word) => word.length > 0).length)
    .sort((a, b) => a - b);
  if (counts.length === 0) return 0;
  const mid = Math.floor(counts.length / 2);
  return counts.length % 2 === 1 ? counts[mid] ?? 0 : ((counts[mid - 1] ?? 0) + (counts[mid] ?? 0)) / 2;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}
