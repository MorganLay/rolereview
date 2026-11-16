/**
 * W2.1: the W2 prompt plus the three writing rules, the render fixes, and
 * one model page-cut. Run A uses the adapter. Run B uses the import prompt.
 * The meaning check is not used.
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { postProcessImport } from "@/features/import/extract";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeContent } from "@/features/tailor/schemas";
import type { TailorOutput } from "@/features/tailor/schemas";
import { buildContent, OutputSchema, SYSTEM } from "@/lib/ai/prompts/import";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { blindAssignment } from "../lib/blind";
import { prepareEvidence } from "../lib/evidence";
import { callTailor, type SavedCall } from "../lib/model-call";
import { loadCase } from "../lib/load";
import { phraseMatch } from "../lib/phrases";
import { EXPERIMENT_CASES, IMPORT_CASES } from "./estimate";
import { applyCoverage, coverageGaps, draftPage } from "./coverage";
import { applyCut, includedCutLines } from "./cut";
import { snapshotFromImport } from "./import-library";
import { libraryDiff } from "./library-diff";
import { defectCounts, loadMustKeep, mustKeepScore } from "./must-keep";
import {
  CoverageSchema,
  coverageMessage,
  coveragePrompt,
  CutSchema,
  cutMessage,
  cutPrompt,
  FixSchema,
  fixMessage,
  fixPrompt,
  normalizeWriteDraft,
  writeDraftToTailor,
  WriteSchema,
  writeVerifyMessage,
  writeVerifyPrompt,
} from "./prompt";
import { applyReplacements, bareAnalysis, dropFlagged, flagRecords, moveWrongEntry, replayDraft } from "./replay";

const DIRECT_RUN = path.join(process.cwd(), "benchmarks", "results", "write-verify-2026-11-14T20-13-44-346Z");
const RESERVE_USD = 0.2;

type Ready = {
  snapshot: LibrarySnapshot;
  job: string;
  analysis: ReturnType<typeof bareAnalysis>;
  libraryBullets: string[];
  resume: string;
};

type SpendCall = { caseId: string; arm: string; costUsd: number };

export async function runW21(input: { maxUsd: number }): Promise<void> {
  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY. No request was sent.");
  if (!userId) throw new Error("Set SEED_USER_ID. No request was sent.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("No User row for SEED_USER_ID. No request was sent.");

  const runId = `write-verify-w21-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(process.cwd(), "benchmarks", "results", runId);
  mkdirSync(directory, { recursive: false });
  const ledger = { spent: 0 };
  const calls: SpendCall[] = [];
  const allow = (label: string) => {
    if (ledger.spent + RESERVE_USD > input.maxUsd) {
      throw new Error(`Stopping before ${label}. Spent $${ledger.spent.toFixed(4)}. The next call could pass $${input.maxUsd.toFixed(2)}.`);
    }
  };

  const prepared = new Map(EXPERIMENT_CASES.map((caseId) => [caseId, prepareCase(caseId)]));

  for (const caseId of EXPERIMENT_CASES) {
    const ready = prepared.get(caseId);
    if (!ready) continue;
    const drafted = await runArm({
      caseId,
      variant: "W21",
      ready,
      userId,
      directory,
      ledger,
      maxUsd: input.maxUsd,
      allow,
    });
    calls.push(...drafted.calls);
  }

  for (const caseId of IMPORT_CASES) {
    const ready = prepared.get(caseId);
    if (!ready) continue;
    allow(`${caseId} import`);
    const imported = await importLibrary(caseId, userId, ready, directory);
    ledger.spent += imported.costUsd;
    calls.push({ caseId, arm: "import", costUsd: imported.costUsd });
    console.log(`${caseId} import $${imported.costUsd.toFixed(4)}. Total $${ledger.spent.toFixed(4)}.`);
    if (!imported.ready) continue;
    const drafted = await runArm({
      caseId,
      variant: "W21-import",
      ready: imported.ready,
      userId,
      directory,
      ledger,
      maxUsd: input.maxUsd,
      allow,
    });
    calls.push(...drafted.calls);
  }

  fitDirectory(directory, "present-count");
  const cut = await cutLongPages({ directory, userId, ledger, maxUsd: input.maxUsd, allow });
  calls.push(...cut.calls);
  fitDirectory(directory, "one");

  for (const caseId of EXPERIMENT_CASES) writeDirect(directory, caseId);
  writeBlind(directory, runId);
  const report = scoreDirectory(directory);
  writeFileSync(path.join(directory, "metrics.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        runId,
        arm: "W2.1",
        status: "paid",
        spentUsd: ledger.spent,
        maxUsd: input.maxUsd,
        calls,
        spendByCase: spendByCase(calls),
        directRun: DIRECT_RUN,
        meaningCheck: "not used",
      },
      null,
      2,
    ),
  );
  console.log(`Saved benchmarks/results/${runId}. Total $${ledger.spent.toFixed(4)} of $${input.maxUsd.toFixed(2)}.`);
}

async function runArm(input: {
  caseId: string;
  variant: string;
  ready: Ready;
  userId: string;
  directory: string;
  ledger: { spent: number };
  maxUsd: number;
  allow: (label: string) => void;
}): Promise<{ calls: SpendCall[] }> {
  const calls: SpendCall[] = [];
  input.allow(`${input.caseId} ${input.variant} draft`);
  const drafted = await draftArm(input.caseId, input.variant, input.userId, input.ready);
  input.ledger.spent += drafted.call.costUsd;
  calls.push({ caseId: input.caseId, arm: input.variant, costUsd: drafted.call.costUsd });
  writeFileSync(path.join(input.directory, `${input.caseId}.${input.variant}.call.json`), JSON.stringify(drafted.call, null, 2));
  console.log(`${input.caseId} ${input.variant} $${drafted.call.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  if (!drafted.draft) return { calls };

  let draft = drafted.draft;
  const gaps = coverageGaps(input.ready.snapshot, draftPage(draft, input.ready.snapshot));
  writeFileSync(path.join(input.directory, `${input.caseId}.${input.variant}.coverage-list.json`), JSON.stringify(gaps, null, 2));
  if (gaps.length > 0) {
    input.allow(`${input.caseId} ${input.variant} coverage`);
    const covered = await callTailor({
      userId: input.userId,
      system: coveragePrompt(),
      userMessage: coverageMessage({ draft: JSON.stringify(draftSummary(draft)), gaps, job: input.ready.job }),
      schema: CoverageSchema,
      refId: `bench:${input.caseId}:${input.variant}:coverage:${randomUUID()}`,
    });
    input.ledger.spent += covered.costUsd;
    calls.push({ caseId: input.caseId, arm: `${input.variant}-coverage`, costUsd: covered.costUsd });
    writeFileSync(path.join(input.directory, `${input.caseId}.${input.variant}.coverage.call.json`), JSON.stringify(covered, null, 2));
    const decisions = covered.ok ? CoverageSchema.safeParse(covered.data).data?.decisions ?? [] : [];
    writeFileSync(path.join(input.directory, `${input.caseId}.${input.variant}.coverage-decisions.json`), JSON.stringify(decisions, null, 2));
    draft = applyCoverage(draft, decisions);
    console.log(`${input.caseId} ${input.variant} coverage $${covered.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  }

  const checked = await verifyDraft({
    draft,
    ready: input.ready,
    userId: input.userId,
    caseId: input.caseId,
    variant: input.variant,
    directory: input.directory,
    ledger: input.ledger,
    maxUsd: input.maxUsd,
  });
  writeVariant(input.directory, input.caseId, input.variant, checked.draft, input.ready);
  return { calls: [...calls, ...checked.calls] };
}

async function importLibrary(
  caseId: string,
  userId: string,
  ready: Ready,
  directory: string,
): Promise<{ costUsd: number; ready: Ready | null }> {
  writeFileSync(path.join(directory, `${caseId}.adapter.library.json`), JSON.stringify(ready.snapshot, null, 2));
  const blocks = buildContent({ kind: "text", text: ready.resume });
  const userMessage = blocks
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter((text) => text.length > 0)
    .join("\n");
  const call = await callTailor({
    userId,
    system: SYSTEM,
    userMessage,
    schema: OutputSchema,
    task: "IMPORT",
    refId: `bench:${caseId}:import:${randomUUID()}`,
  });
  writeFileSync(path.join(directory, `${caseId}.import.call.json`), JSON.stringify(call, null, 2));
  if (!call.ok) return { costUsd: call.costUsd, ready: null };
  const parsed = OutputSchema.safeParse(call.data);
  if (!parsed.success) return { costUsd: call.costUsd, ready: null };
  let snapshot: LibrarySnapshot;
  try {
    snapshot = snapshotFromImport(postProcessImport(parsed.data, ready.resume));
  } catch {
    console.log(`${caseId} import library was not saved.`);
    return { costUsd: call.costUsd, ready: null };
  }
  writeFileSync(path.join(directory, `${caseId}.import.library.json`), JSON.stringify(snapshot, null, 2));
  writeFileSync(
    path.join(directory, `${caseId}.library-diff.json`),
    JSON.stringify(libraryDiff(ready.snapshot, snapshot), null, 2),
  );
  const libraryBullets = snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
  return {
    costUsd: call.costUsd,
    ready: { snapshot, job: ready.job, analysis: bareAnalysis(ready.job), libraryBullets, resume: ready.resume },
  };
}

async function cutLongPages(input: {
  directory: string;
  userId: string;
  ledger: { spent: number };
  maxUsd: number;
  allow: (label: string) => void;
}): Promise<{ calls: SpendCall[] }> {
  const calls: SpendCall[] = [];
  const files = readdirSync(input.directory).filter((name) => name.endsWith(".fit-input.json"));
  for (const name of files) {
    const stem = name.replace(/\.fit-input\.json$/, "");
    const pages = readPages(input.directory, stem);
    if (pages === null || pages <= 1) continue;
    const fitPath = path.join(input.directory, name);
    const saved = JSON.parse(readFileSync(fitPath, "utf8")) as {
      role: { content: ResumeContent; snapshot: LibrarySnapshot };
      job?: string;
    };
    const lines = includedCutLines(saved.role.content);
    if (lines.length === 0) continue;
    input.allow(`${stem} page cut`);
    const call = await callTailor({
      userId: input.userId,
      system: cutPrompt(),
      userMessage: cutMessage(lines, saved.job ?? ""),
      schema: CutSchema,
      refId: `bench:${stem}:cut:${randomUUID()}`,
    });
    input.ledger.spent += call.costUsd;
    const caseId = stem.split(".").slice(0, -1).join(".");
    calls.push({ caseId, arm: `${stem.split(".").at(-1)}-cut`, costUsd: call.costUsd });
    writeFileSync(path.join(input.directory, `${stem}.cut.call.json`), JSON.stringify(call, null, 2));
    const reply = call.ok ? CutSchema.safeParse(call.data).data : undefined;
    const applied = reply ? applyCut(saved.role.content, reply) : null;
    if (applied) saved.role.content = applied.content;
    writeFileSync(fitPath, JSON.stringify(saved));
    writeFileSync(
      path.join(input.directory, `${stem}.cuts.json`),
      JSON.stringify({ pagesBefore: pages, by: "model", log: applied?.log ?? { dropped: [], merged: [], refused: ["no reply"] } }, null, 2),
    );
    console.log(`${stem} cut $${call.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  }
  return { calls };
}

async function verifyDraft(input: {
  draft: TailorOutput;
  ready: Ready;
  userId: string;
  caseId: string;
  variant: string;
  directory: string;
  ledger: { spent: number };
  maxUsd: number;
}): Promise<{ draft: TailorOutput; calls: SpendCall[] }> {
  const calls: SpendCall[] = [];
  const first = replayDraft({ draft: input.draft, snapshot: input.ready.snapshot, analysis: input.ready.analysis, mode: "C" });
  const moved = moveWrongEntry(input.draft, first.flags);
  const draft = moved.draft;
  const afterMove = replayDraft({ draft, snapshot: input.ready.snapshot, analysis: input.ready.analysis, mode: "C" });
  const fixable = afterMove.flags.filter((flag) => flag.code !== "wrong-entry");
  if (fixable.length === 0) return { draft, calls };
  if (input.ledger.spent + RESERVE_USD > input.maxUsd) {
    console.log(`No fix call for ${input.caseId} ${input.variant}. Spent $${input.ledger.spent.toFixed(4)}.`);
    return { draft, calls };
  }
  const records = flagRecords(draft, fixable, input.ready.snapshot);
  writeFileSync(
    path.join(input.directory, `${input.caseId}.${input.variant}.fix-before.json`),
    JSON.stringify({ flags: fixable, lines: records }, null, 2),
  );
  const fixed = await callTailor({
    userId: input.userId,
    system: fixPrompt(),
    userMessage: fixMessage({ flags: records }),
    schema: FixSchema,
    refId: `bench:${input.caseId}:${input.variant}:fix:${randomUUID()}`,
  });
  input.ledger.spent += fixed.costUsd;
  calls.push({ caseId: input.caseId, arm: `${input.variant}-fix`, costUsd: fixed.costUsd });
  writeFileSync(path.join(input.directory, `${input.caseId}.${input.variant}.fix.call.json`), JSON.stringify(fixed, null, 2));
  const replacements = fixed.ok ? FixSchema.safeParse(fixed.data).data?.replacements ?? [] : [];
  const replaced = applyReplacements(draft, replacements);
  const again = replayDraft({ draft: replaced, snapshot: input.ready.snapshot, analysis: input.ready.analysis, mode: "C" });
  const still = again.flags.filter((flag) => flag.code !== "wrong-entry");
  const dropped = dropFlagged(replaced, still);
  writeFileSync(
    path.join(input.directory, `${input.caseId}.${input.variant}.fix-after.json`),
    JSON.stringify({ replacements, stillFlagged: again.flags, dropped: dropped.dropped, moved: moved.moved }, null, 2),
  );
  console.log(`${input.caseId} ${input.variant} fix $${fixed.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  return { draft: dropped.draft, calls };
}

async function draftArm(
  caseId: string,
  variant: string,
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
    refId: `bench:${caseId}:${variant}:${randomUUID()}`,
  });
  if (!call.ok) return { call, draft: null };
  const parsed = WriteSchema.safeParse(call.data);
  return { call, draft: parsed.success ? writeDraftToTailor(parsed.data) : null };
}

function prepareCase(caseId: string): Ready {
  const testCase = loadCase(caseId);
  if (!testCase) throw new Error(`Unknown case ${caseId}.`);
  const prepared = prepareEvidence(testCase);
  const snapshot = prepared.adapted.snapshot;
  return {
    snapshot,
    job: prepared.evidence.job,
    analysis: bareAnalysis(prepared.evidence.job),
    libraryBullets: snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)),
    resume: prepared.evidence.resume,
  };
}

function writeVariant(directory: string, caseId: string, variant: string, draft: TailorOutput, ready: Ready): void {
  const replay = replayDraft({ draft, snapshot: ready.snapshot, analysis: ready.analysis, mode: "C" });
  writeFileSync(
    path.join(directory, `${caseId}.${variant}.fit-input.json`),
    JSON.stringify({ role: { content: replay.content, snapshot: ready.snapshot }, baseline: null, job: ready.job }),
  );
}

function writeDirect(directory: string, caseId: string): void {
  const fitted = readFileSync(path.join(DIRECT_RUN, `${caseId}.direct.fitted.json`), "utf8");
  const parsed = JSON.parse(fitted) as { role?: { text?: string } };
  writeFileSync(path.join(directory, `${caseId}.direct.fitted.json`), fitted);
  writeFileSync(path.join(directory, `${caseId}.direct.txt`), parsed.role?.text ?? "");
}

function writeBlind(directory: string, runId: string): void {
  const blind = path.join(directory, "blind");
  mkdirSync(blind);
  const key = [];
  for (const caseId of EXPERIMENT_CASES) {
    const assignment = blindAssignment(caseId, runId);
    const folder = path.join(blind, caseId);
    const arm = path.join(directory, `${caseId}.W21.pdf`);
    const direct = path.join(DIRECT_RUN, `${caseId}.direct.pdf`);
    if (!existsSync(arm) || !existsSync(direct)) {
      key.push({ caseId, A: "missing", B: "missing" });
      continue;
    }
    mkdirSync(folder);
    const armFirst = assignment.a === "roleRefine";
    copyFileSync(armFirst ? arm : direct, path.join(folder, "A.pdf"));
    copyFileSync(armFirst ? direct : arm, path.join(folder, "B.pdf"));
    const [candidate, job] = caseId.split("-");
    copyFileSync(path.join(process.cwd(), "benchmarks", "fixtures", "jobs", `${job}.md`), path.join(folder, "posting.md"));
    copyFileSync(
      path.join(process.cwd(), "benchmarks", "fixtures", "candidates", candidate ?? "", "original-resume.txt"),
      path.join(folder, "original-resume.txt"),
    );
    key.push({ caseId, A: armFirst ? "W2.1" : "direct", B: armFirst ? "direct" : "W2.1" });
  }
  writeFileSync(path.join(directory, "key.json"), JSON.stringify({ runId, cases: key }, null, 2));
}

function fitDirectory(directory: string, mode: "present-count" | "one"): void {
  const ran = spawnSync("npx", ["vitest", "run", "tests/unit/benchmark-fit-saved.test.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, BENCHMARK_FIT_DIR: directory, BENCHMARK_FIT_MODE: mode, BENCHMARK_WRITE_PDF: mode === "one" ? "1" : "" },
    shell: true,
    encoding: "utf8",
  });
  if (ran.status !== 0) console.error(ran.stderr || ran.stdout || "Page fit did not complete.");
}

function readPages(directory: string, stem: string): number | null {
  const file = path.join(directory, `${stem}.pages.json`);
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { pages?: number | null };
    return typeof parsed.pages === "number" ? parsed.pages : null;
  } catch {
    return null;
  }
}

function scoreDirectory(directory: string): unknown {
  const lists = loadMustKeep();
  const rows = [];
  const variants = ["W21", "direct"] as const;
  for (const caseId of EXPERIMENT_CASES) {
    const ready = prepareCase(caseId);
    const testCase = loadCase(caseId);
    for (const variant of variants) {
      rows.push(scoreOne(directory, caseId, variant, lists[caseId] ?? [], ready.libraryBullets, testCase?.avoidClaims ?? []));
    }
  }
  for (const caseId of IMPORT_CASES) {
    const file = path.join(directory, `${caseId}.import.library.json`);
    try {
      const snapshot = JSON.parse(readFileSync(file, "utf8")) as LibrarySnapshot;
      const bullets = snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
      const testCase = loadCase(caseId);
      rows.push(scoreOne(directory, caseId, "W21-import", lists[caseId] ?? [], bullets, testCase?.avoidClaims ?? []));
    } catch {
      rows.push({ caseId, variant: "W21-import", kept: 0, total: 0, missing: [], rate: 0, note: "Import library was not saved." });
    }
  }
  return { rows };
}

function scoreOne(
  directory: string,
  caseId: string,
  variant: string,
  items: Parameters<typeof mustKeepScore>[1],
  libraryBullets: string[],
  avoidClaims: readonly string[],
): unknown {
  const fitted = readFitted(directory, caseId, variant);
  const coverage = mustKeepScore(fitted.text, items);
  return {
    caseId,
    variant,
    ...coverage,
    rate: coverage.total === 0 ? 0 : coverage.kept / coverage.total,
    defects: defectCounts(fitted.text, libraryBullets),
    avoid: avoidClaims.filter((phrase) => phraseMatch(fitted.text, phrase) !== "absent"),
    pages: fitted.pageLimit,
    fitterRemoved: fitted.dropped,
    fitterNote: fitted.note,
  };
}

function readFitted(
  directory: string,
  caseId: string,
  variant: string,
): { text: string; pageLimit: number | null; dropped: string[]; note: string } {
  const file = path.join(directory, `${caseId}.${variant}.fitted.json`);
  if (!existsSync(file)) return { text: "", pageLimit: null, dropped: [], note: "No fitted resume." };
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    role?: { text?: string; pageLimit?: number | null; dropped?: string[]; note?: string };
  };
  return {
    text: parsed.role?.text ?? "",
    pageLimit: parsed.role?.pageLimit ?? null,
    dropped: parsed.role?.dropped ?? [],
    note: parsed.role?.note ?? "",
  };
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

function spendByCase(calls: readonly SpendCall[]): { caseId: string; usd: number }[] {
  const totals = new Map<string, number>();
  for (const call of calls) totals.set(call.caseId, (totals.get(call.caseId) ?? 0) + call.costUsd);
  return [...totals].map(([caseId, usd]) => ({ caseId, usd: Number(usd.toFixed(4)) }));
}
