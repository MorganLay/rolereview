/**
 * W3 on imported libraries, plus the current production tailor on those
 * same libraries. Saved direct resumes are reused. The meaning check is not used.
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { postProcessImport } from "@/features/import/extract";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { libraryPromptText } from "@/features/library/serialize";
import type { ResumeContent } from "@/features/tailor/schemas";
import type { TailorOutput } from "@/features/tailor/schemas";
import { buildContent, OutputSchema, SYSTEM } from "@/lib/ai/prompts/import";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { blindAssignment } from "../lib/blind";
import { prepareEvidence } from "../lib/evidence";
import { callTailor, type SavedCall } from "../lib/model-call";
import { loadCase } from "../lib/load";
import { runCase } from "../lib/paid";
import { EXPERIMENT_CASES } from "./estimate";
import { applyCoveragePage, coverageGaps, draftPage } from "./coverage";
import { applyCut, includedCutLines } from "./cut";
import { snapshotFromImport } from "./import-library";
import { auditImport } from "./import-audit";
import { parseTitleDates } from "./import-dates";
import { loadMustKeep, mustKeepScore } from "./must-keep";
import {
  CoverageW3Schema,
  coverageW3Message,
  coverageW3Prompt,
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
  writeVerifyW3Prompt,
} from "./prompt";
import { applyReplacements, bareAnalysis, dropFlagged, flagRecords, moveWrongEntry, replayDraft } from "./replay";
import { stripPlaceholders, w3Defects } from "./w3-defects";

const DIRECT_RUN = path.join(process.cwd(), "benchmarks", "results", "write-verify-2026-11-14T20-13-44-346Z");
const RESERVE_USD = 0.2;
const PRODUCTION_RESERVE_USD = 0.35;

type Ready = {
  snapshot: LibrarySnapshot;
  job: string;
  analysis: ReturnType<typeof bareAnalysis>;
  libraryBullets: string[];
  resume: string;
};

type SpendCall = { caseId: string; arm: string; costUsd: number };

export async function runW3(input: { maxUsd: number }): Promise<void> {
  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY. No request was sent.");
  if (!userId) throw new Error("Set SEED_USER_ID. No request was sent.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("No User row for SEED_USER_ID. No request was sent.");

  const runId = `write-verify-w3-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(process.cwd(), "benchmarks", "results", runId);
  mkdirSync(directory, { recursive: false });
  const ledger = { spent: 0 };
  const calls: SpendCall[] = [];
  const allow = (label: string, reserve = RESERVE_USD) => {
    if (ledger.spent + reserve > input.maxUsd) {
      throw new Error(`Stopping before ${label}. Spent $${ledger.spent.toFixed(4)}. The next call could pass $${input.maxUsd.toFixed(2)}.`);
    }
  };

  const ready = new Map<string, Ready>();
  for (const caseId of EXPERIMENT_CASES) {
    allow(`${caseId} import`);
    const imported = await importCase(caseId, userId, directory);
    ledger.spent += imported.costUsd;
    calls.push({ caseId, arm: "import", costUsd: imported.costUsd });
    console.log(`${caseId} import $${imported.costUsd.toFixed(4)}. Total $${ledger.spent.toFixed(4)}.`);
    if (imported.ready) ready.set(caseId, imported.ready);
  }

  for (const caseId of EXPERIMENT_CASES) {
    const library = ready.get(caseId);
    if (!library) continue;
    const drafted = await runDraft({ caseId, library, userId, directory, ledger, maxUsd: input.maxUsd, allow });
    calls.push(...drafted.calls);
  }

  fitDirectory(directory, "present-count");
  for (const caseId of EXPERIMENT_CASES) {
    const library = ready.get(caseId);
    if (!library) continue;
    const covered = await coverCase({ caseId, library, userId, directory, ledger, allow });
    calls.push(...covered);
  }
  fitDirectory(directory, "present-count");
  const cut = await cutLongPages({ directory, userId, ledger, allow });
  calls.push(...cut);

  for (const caseId of EXPERIMENT_CASES) {
    const library = ready.get(caseId);
    if (!library) continue;
    if (ledger.spent + PRODUCTION_RESERVE_USD > input.maxUsd) {
      console.log(`No production tailor for ${caseId}. Spent $${ledger.spent.toFixed(4)}.`);
      break;
    }
    const testCase = loadCase(caseId);
    if (!testCase) continue;
    let result: Awaited<ReturnType<typeof runCase>>;
    try {
      result = await runCase({
        testCase,
        userId,
        maxUsd: input.maxUsd,
        spent: () => ledger.spent,
        add: (usd) => {
          ledger.spent += usd;
        },
        library: { snapshot: library.snapshot, libraryText: libraryPromptText(library.snapshot) },
        skipBaseline: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("Stopping")) {
        console.log(message);
        break;
      }
      console.log(`${caseId} production did not finish.`);
      continue;
    }
    calls.push(...result.calls.map((call) => ({ caseId, arm: `production-${call.label}`, costUsd: call.usd })));
    if (result.roleFitInput) {
      writeFileSync(
        path.join(directory, `${caseId}.production.fit-input.json`),
        JSON.stringify({ role: result.roleFitInput, baseline: null }),
      );
    }
    console.log(`${caseId} production $${result.costUsd.toFixed(4)}. Total $${ledger.spent.toFixed(4)}.`);
  }

  const removed = writeDirect(directory);
  fitDirectory(directory, "w3mix");
  writeBlind(directory, runId);
  writeFileSync(path.join(directory, "metrics.json"), JSON.stringify(scoreDirectory(directory, ready), null, 2));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        runId,
        arm: "W3",
        status: "paid",
        spentUsd: ledger.spent,
        maxUsd: input.maxUsd,
        calls,
        spendByCase: spendByCase(calls),
        directPlaceholdersRemoved: removed,
        directRun: DIRECT_RUN,
        meaningCheck: "not used",
      },
      null,
      2,
    ),
  );
  console.log(`Saved benchmarks/results/${runId}. Total $${ledger.spent.toFixed(4)} of $${input.maxUsd.toFixed(2)}.`);
}

async function importCase(
  caseId: string,
  userId: string,
  directory: string,
): Promise<{ costUsd: number; ready: Ready | null }> {
  const source = sourceOf(caseId);
  const blocks = buildContent({ kind: "text", text: source.resume });
  const userMessage = blocks.map((block) => (block.type === "text" ? block.text : "")).filter((text) => text.length > 0).join("\n");
  const call = await callTailor({
    userId,
    system: SYSTEM,
    userMessage,
    schema: OutputSchema,
    task: "IMPORT",
    refId: `bench:${caseId}:w3:import:${randomUUID()}`,
  });
  writeFileSync(path.join(directory, `${caseId}.import.call.json`), JSON.stringify(call, null, 2));
  if (!call.ok) return { costUsd: call.costUsd, ready: null };
  const parsed = OutputSchema.safeParse(call.data);
  if (!parsed.success) return { costUsd: call.costUsd, ready: null };
  let snapshot: LibrarySnapshot;
  try {
    snapshot = snapshotFromImport(postProcessImport(parsed.data, source.resume));
  } catch {
    console.log(`${caseId} import library was not saved.`);
    return { costUsd: call.costUsd, ready: null };
  }
  const dated = parseTitleDates(snapshot);
  writeFileSync(path.join(directory, `${caseId}.import.library.json`), JSON.stringify(dated.snapshot, null, 2));
  writeFileSync(path.join(directory, `${caseId}.import.dates.json`), JSON.stringify(dated.parsed, null, 2));
  writeFileSync(
    path.join(directory, `${caseId}.import.errors.json`),
    JSON.stringify(auditImport(source.resume, dated.snapshot), null, 2),
  );
  return {
    costUsd: call.costUsd,
    ready: {
      snapshot: dated.snapshot,
      job: source.job,
      analysis: bareAnalysis(source.job),
      libraryBullets: dated.snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)),
      resume: source.resume,
    },
  };
}

async function runDraft(input: {
  caseId: string;
  library: Ready;
  userId: string;
  directory: string;
  ledger: { spent: number };
  maxUsd: number;
  allow: (label: string) => void;
}): Promise<{ calls: SpendCall[] }> {
  const calls: SpendCall[] = [];
  input.allow(`${input.caseId} W3 draft`);
  const drafted = await draftW3(input.caseId, input.userId, input.library);
  input.ledger.spent += drafted.call.costUsd;
  calls.push({ caseId: input.caseId, arm: "W3", costUsd: drafted.call.costUsd });
  writeFileSync(path.join(input.directory, `${input.caseId}.W3.call.json`), JSON.stringify(drafted.call, null, 2));
  console.log(`${input.caseId} W3 $${drafted.call.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  if (!drafted.draft) return { calls };

  const draft = drafted.draft;
  const gaps = coverageGaps(input.library.snapshot, draftPage(draft, input.library.snapshot));
  writeFileSync(path.join(input.directory, `${input.caseId}.W3.coverage-list.json`), JSON.stringify(gaps, null, 2));
  const checked = await verifyDraft({ ...input, draft });
  calls.push(...checked.calls);
  writeVariant(input.directory, input.caseId, checked.draft, input.library);
  return { calls };
}

async function coverCase(input: {
  caseId: string;
  library: Ready;
  userId: string;
  directory: string;
  ledger: { spent: number };
  allow: (label: string) => void;
}): Promise<SpendCall[]> {
  const listPath = path.join(input.directory, `${input.caseId}.W3.coverage-list.json`);
  const fitPath = path.join(input.directory, `${input.caseId}.W3.fit-input.json`);
  if (!existsSync(listPath) || !existsSync(fitPath)) return [];
  const gaps = JSON.parse(readFileSync(listPath, "utf8")) as string[];
  if (gaps.length === 0) return [];
  const pages = readPages(input.directory, `${input.caseId}.W3`);
  input.allow(`${input.caseId} W3 coverage`);
  const saved = JSON.parse(readFileSync(fitPath, "utf8")) as {
    role: { content: ResumeContent; snapshot: LibrarySnapshot };
    draft?: TailorOutput;
  };
  if (!saved.draft) return [];
  const covered = await callTailor({
    userId: input.userId,
    system: coverageW3Prompt(),
    userMessage: coverageW3Message({
      draft: JSON.stringify(draftSummary(saved.draft)),
      gaps,
      job: input.library.job,
      pages: pages ?? 1,
    }),
    schema: CoverageW3Schema,
    normalize: normalizeCoverage,
    refId: `bench:${input.caseId}:w3:coverage:${randomUUID()}`,
  });
  input.ledger.spent += covered.costUsd;
  writeFileSync(path.join(input.directory, `${input.caseId}.W3.coverage.call.json`), JSON.stringify(covered, null, 2));
  const decisions = covered.ok ? CoverageW3Schema.safeParse(covered.data).data?.decisions ?? [] : [];
  const applied = applyCoveragePage(saved.draft, decisions, pages ?? 1);
  writeFileSync(
    path.join(input.directory, `${input.caseId}.W3.coverage-decisions.json`),
    JSON.stringify({ decisions, applied: applied.applied, refused: applied.refused }, null, 2),
  );
  writeVariant(input.directory, input.caseId, applied.draft, input.library);
  console.log(`${input.caseId} W3 coverage $${covered.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  return [{ caseId: input.caseId, arm: "W3-coverage", costUsd: covered.costUsd }];
}

function normalizeCoverage(value: unknown): unknown {
  const draft = value as { decisions?: { replaces?: unknown }[] };
  if (Array.isArray(draft?.decisions)) {
    for (const item of draft.decisions) {
      if (typeof item.replaces !== "string") item.replaces = "";
    }
  }
  return value;
}

async function verifyDraft(input: {
  draft: TailorOutput;
  library: Ready;
  userId: string;
  caseId: string;
  directory: string;
  ledger: { spent: number };
  maxUsd: number;
}): Promise<{ draft: TailorOutput; calls: SpendCall[] }> {
  const calls: SpendCall[] = [];
  const first = replayDraft({ draft: input.draft, snapshot: input.library.snapshot, analysis: input.library.analysis, mode: "C" });
  const moved = moveWrongEntry(input.draft, first.flags);
  const draft = moved.draft;
  const afterMove = replayDraft({ draft, snapshot: input.library.snapshot, analysis: input.library.analysis, mode: "C" });
  const fixable = afterMove.flags.filter((flag) => flag.code !== "wrong-entry");
  if (fixable.length === 0) return { draft, calls };
  if (input.ledger.spent + RESERVE_USD > input.maxUsd) return { draft, calls };
  const records = flagRecords(draft, fixable, input.library.snapshot);
  const fixed = await callTailor({
    userId: input.userId,
    system: fixPrompt(),
    userMessage: fixMessage({ flags: records }),
    schema: FixSchema,
    refId: `bench:${input.caseId}:w3:fix:${randomUUID()}`,
  });
  input.ledger.spent += fixed.costUsd;
  calls.push({ caseId: input.caseId, arm: "W3-fix", costUsd: fixed.costUsd });
  writeFileSync(path.join(input.directory, `${input.caseId}.W3.fix.call.json`), JSON.stringify(fixed, null, 2));
  const replacements = fixed.ok ? FixSchema.safeParse(fixed.data).data?.replacements ?? [] : [];
  const replaced = applyReplacements(draft, replacements);
  const again = replayDraft({ draft: replaced, snapshot: input.library.snapshot, analysis: input.library.analysis, mode: "C" });
  const dropped = dropFlagged(replaced, again.flags.filter((flag) => flag.code !== "wrong-entry"));
  console.log(`${input.caseId} W3 fix $${fixed.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  return { draft: dropped.draft, calls };
}

async function draftW3(caseId: string, userId: string, library: Ready): Promise<{ call: SavedCall; draft: TailorOutput | null }> {
  const message = writeVerifyMessage(library.snapshot, library.job);
  const call = await callTailor({
    userId,
    system: writeVerifyW3Prompt(),
    userMessage: message.text,
    schema: WriteSchema,
    normalize: normalizeWriteDraft,
    refId: `bench:${caseId}:w3:${randomUUID()}`,
  });
  if (!call.ok) return { call, draft: null };
  const parsed = WriteSchema.safeParse(call.data);
  return { call, draft: parsed.success ? writeDraftToTailor(parsed.data) : null };
}

function writeVariant(directory: string, caseId: string, draft: TailorOutput, library: Ready): void {
  const replay = replayDraft({ draft, snapshot: library.snapshot, analysis: library.analysis, mode: "C" });
  writeFileSync(
    path.join(directory, `${caseId}.W3.fit-input.json`),
    JSON.stringify({ role: { content: replay.content, snapshot: library.snapshot }, baseline: null, job: library.job, draft }),
  );
}

async function cutLongPages(input: {
  directory: string;
  userId: string;
  ledger: { spent: number };
  allow: (label: string) => void;
}): Promise<SpendCall[]> {
  const calls: SpendCall[] = [];
  const files = readdirSync(input.directory).filter((name) => name.endsWith(".W3.fit-input.json"));
  for (const name of files) {
    const stem = name.replace(/\.fit-input\.json$/, "");
    const pages = readPages(input.directory, stem);
    if (pages === null || pages <= 1) continue;
    const fitPath = path.join(input.directory, name);
    const saved = JSON.parse(readFileSync(fitPath, "utf8")) as {
      role: { content: ResumeContent; snapshot: LibrarySnapshot };
      job?: string;
      draft?: TailorOutput;
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
    const caseId = stem.split(".")[0] ?? stem;
    calls.push({ caseId, arm: "W3-cut", costUsd: call.costUsd });
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
  return calls;
}

function writeDirect(directory: string): { caseId: string; removed: string[] }[] {
  const removed = [];
  for (const caseId of EXPERIMENT_CASES) {
    const fitted = readFileSync(path.join(DIRECT_RUN, `${caseId}.direct.fitted.json`), "utf8");
    const parsed = JSON.parse(fitted) as { role?: { text?: string } };
    const text = parsed.role?.text ?? "";
    writeFileSync(path.join(directory, `${caseId}.direct.fitted.json`), fitted);
    writeFileSync(path.join(directory, `${caseId}.direct.txt`), text);
    const packet = stripPlaceholders(text);
    writeFileSync(path.join(directory, `${caseId}.direct.blind-input.json`), JSON.stringify({ text: packet.text }));
    removed.push({ caseId, removed: packet.removed });
  }
  return removed;
}

function writeBlind(directory: string, runId: string): void {
  const blind = path.join(directory, "blind");
  mkdirSync(blind);
  const key = [];
  for (const caseId of EXPERIMENT_CASES) {
    const assignment = blindAssignment(caseId, runId);
    const arm = path.join(directory, `${caseId}.W3.pdf`);
    const direct = path.join(directory, `${caseId}.direct.blind.pdf`);
    if (!existsSync(arm) || !existsSync(direct)) {
      key.push({ caseId, A: "missing", B: "missing" });
      continue;
    }
    const folder = path.join(blind, caseId);
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
    key.push({ caseId, A: armFirst ? "W3" : "direct", B: armFirst ? "direct" : "W3" });
  }
  writeFileSync(path.join(directory, "key.json"), JSON.stringify({ runId, cases: key }, null, 2));
}

function fitDirectory(directory: string, mode: "present-count" | "w3mix"): void {
  const ran = spawnSync("npx", ["vitest", "run", "tests/unit/benchmark-fit-saved.test.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BENCHMARK_FIT_DIR: directory,
      BENCHMARK_FIT_MODE: mode,
      BENCHMARK_WRITE_PDF: mode === "w3mix" ? "1" : "",
    },
    shell: true,
    encoding: "utf8",
  });
  if (ran.status !== 0) console.error(ran.stderr || ran.stdout || "Page fit did not complete.");
}

function sourceOf(caseId: string): { resume: string; job: string } {
  const testCase = loadCase(caseId);
  if (!testCase) throw new Error(`Unknown case ${caseId}.`);
  const prepared = prepareEvidence(testCase);
  return { resume: prepared.evidence.resume, job: prepared.evidence.job };
}

function readPages(directory: string, stem: string): number | null {
  try {
    const parsed = JSON.parse(readFileSync(path.join(directory, `${stem}.pages.json`), "utf8")) as { pages?: number | null };
    return typeof parsed.pages === "number" ? parsed.pages : null;
  } catch {
    return null;
  }
}

function scoreDirectory(directory: string, ready: Map<string, Ready>): unknown {
  const lists = loadMustKeep();
  const rows = [];
  for (const caseId of EXPERIMENT_CASES) {
    const library = ready.get(caseId);
    const bullets = library?.libraryBullets ?? [];
    const items = lists[caseId] ?? [];
    for (const variant of ["W3", "production", "direct"] as const) {
      const fitted = readFitted(directory, caseId, variant);
      const coverage = mustKeepScore(fitted.text, items);
      const defects = w3Defects(fitted.text, bullets);
      rows.push({
        caseId,
        variant,
        ...coverage,
        rate: coverage.total === 0 ? 0 : coverage.kept / coverage.total,
        defects,
        pages: fitted.pageLimit,
        fitterRemoved: fitted.dropped,
        fitterNote: fitted.note,
        words: fitted.text.split(/\s+/).filter((word) => word.length > 0).length,
      });
    }
  }
  return { rows };
}

function readFitted(
  directory: string,
  caseId: string,
  variant: string,
): { text: string; pageLimit: number | null; dropped: string[]; note: string } {
  const file = path.join(directory, variant === "direct" ? `${caseId}.direct.fitted.json` : `${caseId}.${variant}.fitted.json`);
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
