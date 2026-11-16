/**
 * W5 on libraries checked with the normalised import comparison.
 * Saved direct resumes and the saved production results are not called again.
 * The writer prompt is the W4 prompt.
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { postProcessImport } from "@/features/import/extract";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeContent, TailorOutput } from "@/features/tailor/schemas";
import { OutputSchema } from "@/lib/ai/prompts/import";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { blindAssignment } from "../lib/blind";
import { prepareEvidence } from "../lib/evidence";
import { callTailor, type SavedCall } from "../lib/model-call";
import { loadCase } from "../lib/load";
import { EXPERIMENT_CASES } from "./estimate";
import { applyCoveragePage, coverageGaps, draftPage } from "./coverage";
import { applyW5Cut, includedCutLines } from "./cut";
import { applyRoleDates } from "./import-dates";
import {
  RepairSchema,
  applyRepair,
  dedupeLibrary,
  mergeDuplicateRoles,
  missingSpans,
  normalizeRepair,
  repairMessage,
  repairPrompt,
  type MissingSpan,
} from "./import-fidelity";
import { snapshotFromImport } from "./import-library";
import { loadMustKeep, mustKeepScore } from "./must-keep";
import {
  CoverageW3Schema,
  coverageW3Message,
  coverageW4Prompt,
  CutW5Schema,
  cutMessage,
  cutW5Prompt,
  FixSchema,
  fixMessage,
  fixPrompt,
  normalizeCutW5,
  normalizeWriteDraft,
  writeDraftToTailor,
  WriteSchema,
  writeVerifyMessage,
  writeVerifyW4Prompt,
} from "./prompt";
import { applyReplacements, bareAnalysis, dropFlagged, flagRecords, moveWrongEntry, replayDraft } from "./replay";
import { readerDefects, stripPlaceholders } from "./w3-defects";

const W3_RUN = path.join(process.cwd(), "benchmarks", "results", "write-verify-w3-2026-11-15T09-21-40-878Z");
const W4_RUN = path.join(process.cwd(), "benchmarks", "results", "write-verify-w4-2026-11-15T21-09-45-413Z");
const DIRECT_RUN = path.join(process.cwd(), "benchmarks", "results", "write-verify-2026-11-14T20-13-44-346Z");
const RESERVE_USD = 0.08;

type Ready = {
  snapshot: LibrarySnapshot;
  job: string;
  analysis: ReturnType<typeof bareAnalysis>;
  libraryBullets: string[];
  resume: string;
};

type SpendCall = { caseId: string; arm: string; costUsd: number };
type FidelityRow = {
  caseId: string;
  before: number;
  after: number;
  placed: number;
  removedEntries: number;
  removedBullets: number;
  merged: number;
  repairUsd: number;
};

export async function runW5(input: { maxUsd: number }): Promise<void> {
  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY. No request was sent.");
  if (!userId) throw new Error("Set SEED_USER_ID. No request was sent.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("No User row for SEED_USER_ID. No request was sent.");

  const runId = `write-verify-w5-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(process.cwd(), "benchmarks", "results", runId);
  mkdirSync(directory, { recursive: false });
  const ledger = { spent: 0 };
  const calls: SpendCall[] = [];
  const allow = (label: string, reserve = RESERVE_USD) => {
    if (ledger.spent + reserve <= input.maxUsd) return true;
    console.log(`Stopping before ${label}. Spent $${ledger.spent.toFixed(4)}.`);
    return false;
  };

  const ready = new Map<string, Ready>();
  const fidelity: FidelityRow[] = [];
  for (const caseId of EXPERIMENT_CASES) {
    const source = sourceOf(caseId);
    const imported = libraryFromSavedCall(caseId, source.resume);
    if (!imported) {
      console.log(`${caseId} saved import was not readable.`);
      fidelity.push({ caseId, before: -1, after: -1, placed: 0, removedEntries: 0, removedBullets: 0, merged: 0, repairUsd: 0 });
      continue;
    }
    const dated = applyRoleDates(imported);
    const before = missingSpans(source.resume, dated.snapshot);
    writeFileSync(path.join(directory, `${caseId}.import.gaps-before.json`), JSON.stringify(before, null, 2));
    let snapshot = dated.snapshot;
    let repairUsd = 0;
    let placed = 0;
    if (before.length > 0 && allow(`${caseId} import repair`)) {
      const repaired = await repairCase(caseId, userId, source.resume, snapshot, before);
      repairUsd = repaired.costUsd;
      ledger.spent += repairUsd;
      calls.push({ caseId, arm: "import-repair", costUsd: repairUsd });
      writeFileSync(path.join(directory, `${caseId}.import.repair.call.json`), JSON.stringify(repaired.call, null, 2));
      snapshot = repaired.snapshot;
      placed = repaired.placed;
      console.log(`${caseId} repair $${repairUsd.toFixed(4)}. Placed ${placed}. Total $${ledger.spent.toFixed(4)}.`);
    }
    const cleaned = dedupeLibrary(snapshot);
    const merged = mergeDuplicateRoles(cleaned.snapshot);
    const after = missingSpans(source.resume, merged.snapshot);
    writeFileSync(path.join(directory, `${caseId}.import.library.json`), JSON.stringify(merged.snapshot, null, 2));
    writeFileSync(path.join(directory, `${caseId}.import.dates.json`), JSON.stringify(dated.changes, null, 2));
    writeFileSync(path.join(directory, `${caseId}.import.merged.json`), JSON.stringify(merged.merged, null, 2));
    writeFileSync(path.join(directory, `${caseId}.import.gaps-after.json`), JSON.stringify(after, null, 2));
    fidelity.push({
      caseId,
      before: before.length,
      after: after.length,
      placed,
      removedEntries: cleaned.removedEntries.length,
      removedBullets: cleaned.removedBullets.length,
      merged: merged.merged.length,
      repairUsd,
    });
    ready.set(caseId, {
      snapshot: merged.snapshot,
      job: source.job,
      analysis: bareAnalysis(source.job),
      libraryBullets: merged.snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)),
      resume: source.resume,
    });
    console.log(`${caseId} missing spans ${before.length} before, ${after.length} after.`);
  }

  for (const caseId of EXPERIMENT_CASES) {
    const library = ready.get(caseId);
    if (!library || !allow(`${caseId} W5 draft`)) continue;
    const drafted = await runDraft({ caseId, library, userId, directory, ledger, allow });
    calls.push(...drafted.calls);
  }

  fitDirectory(directory, "present-count");
  for (const caseId of EXPERIMENT_CASES) {
    const library = ready.get(caseId);
    if (!library) continue;
    const covered = await coverCase({ caseId, library, userId, directory, ledger, allow });
    calls.push(...covered);
  }
  const cut = await cutToOnePage({ directory, userId, ledger, allow });
  calls.push(...cut);

  const removed = writeDirect(directory);
  fitDirectory(directory, "w5mix");
  writeBlind(directory, runId);
  writeFileSync(path.join(directory, "fidelity.json"), JSON.stringify(fidelity, null, 2));
  writeFileSync(path.join(directory, "metrics.json"), JSON.stringify(scoreDirectory(directory, ready), null, 2));
  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        runId,
        arm: "W5",
        status: "paid",
        spentUsd: ledger.spent,
        maxUsd: input.maxUsd,
        calls,
        spendByCase: spendByCase(calls),
        directPlaceholdersRemoved: removed,
        directRun: DIRECT_RUN,
        w3Run: W3_RUN,
        w4Run: W4_RUN,
        production: "reused",
        meaningCheck: "not used",
        prompt: "W4 unchanged",
        fidelity,
      },
      null,
      2,
    ),
  );
  console.log(`Saved benchmarks/results/${runId}. Total $${ledger.spent.toFixed(4)} of $${input.maxUsd.toFixed(2)}.`);
}

function libraryFromSavedCall(caseId: string, resume: string): LibrarySnapshot | null {
  try {
    const saved = JSON.parse(readFileSync(path.join(W3_RUN, `${caseId}.import.call.json`), "utf8")) as { data?: unknown; raw?: string };
    const parsed = OutputSchema.safeParse(saved.data ?? JSON.parse(saved.raw ?? "null"));
    if (!parsed.success) return null;
    return snapshotFromImport(postProcessImport(parsed.data, resume));
  } catch {
    return null;
  }
}

async function repairCase(
  caseId: string,
  userId: string,
  resume: string,
  snapshot: LibrarySnapshot,
  spans: MissingSpan[],
): Promise<{ costUsd: number; call: SavedCall; snapshot: LibrarySnapshot; placed: number }> {
  const call = await callTailor({
    userId,
    system: repairPrompt(),
    userMessage: repairMessage({ resume, library: snapshot, spans }),
    schema: RepairSchema,
    normalize: normalizeRepair,
    task: "IMPORT",
    refId: `bench:${caseId}:w5:repair:${randomUUID()}`,
  });
  const placements = call.ok ? RepairSchema.safeParse(call.data).data?.placements ?? [] : [];
  const applied = applyRepair({ snapshot, resume, spans, placements });
  return { costUsd: call.costUsd, call, snapshot: applied.snapshot, placed: applied.placed };
}

async function runDraft(input: {
  caseId: string;
  library: Ready;
  userId: string;
  directory: string;
  ledger: { spent: number };
  allow: (label: string) => boolean;
}): Promise<{ calls: SpendCall[] }> {
  const calls: SpendCall[] = [];
  const drafted = await draftW5(input.caseId, input.userId, input.library);
  input.ledger.spent += drafted.call.costUsd;
  calls.push({ caseId: input.caseId, arm: "W5", costUsd: drafted.call.costUsd });
  writeFileSync(path.join(input.directory, `${input.caseId}.W5.call.json`), JSON.stringify(drafted.call, null, 2));
  console.log(`${input.caseId} W5 $${drafted.call.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  if (!drafted.draft) return { calls };
  const gaps = coverageGaps(input.library.snapshot, draftPage(drafted.draft, input.library.snapshot));
  writeFileSync(path.join(input.directory, `${input.caseId}.W5.coverage-list.json`), JSON.stringify(gaps, null, 2));
  const checked = await verifyDraft({ ...input, draft: drafted.draft });
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
  allow: (label: string) => boolean;
}): Promise<SpendCall[]> {
  const listPath = path.join(input.directory, `${input.caseId}.W5.coverage-list.json`);
  const fitPath = path.join(input.directory, `${input.caseId}.W5.fit-input.json`);
  if (!existsSync(listPath) || !existsSync(fitPath)) return [];
  const gaps = JSON.parse(readFileSync(listPath, "utf8")) as string[];
  if (gaps.length === 0) return [];
  if (!input.allow(`${input.caseId} W5 coverage`)) return [];
  const pages = readPages(input.directory, `${input.caseId}.W5`);
  const saved = JSON.parse(readFileSync(fitPath, "utf8")) as {
    role: { content: ResumeContent; snapshot: LibrarySnapshot };
    draft?: TailorOutput;
  };
  if (!saved.draft) return [];
  const covered = await callTailor({
    userId: input.userId,
    system: coverageW4Prompt(),
    userMessage: coverageW3Message({
      draft: JSON.stringify(draftSummary(saved.draft)),
      gaps,
      job: input.library.job,
      pages: pages ?? 1,
    }),
    schema: CoverageW3Schema,
    normalize: normalizeCoverage,
    refId: `bench:${input.caseId}:w5:coverage:${randomUUID()}`,
  });
  input.ledger.spent += covered.costUsd;
  writeFileSync(path.join(input.directory, `${input.caseId}.W5.coverage.call.json`), JSON.stringify(covered, null, 2));
  const decisions = covered.ok ? CoverageW3Schema.safeParse(covered.data).data?.decisions ?? [] : [];
  const applied = applyCoveragePage(saved.draft, decisions, pages ?? 1);
  writeFileSync(
    path.join(input.directory, `${input.caseId}.W5.coverage-decisions.json`),
    JSON.stringify({ decisions, applied: applied.applied, refused: applied.refused }, null, 2),
  );
  writeVariant(input.directory, input.caseId, applied.draft, input.library);
  console.log(`${input.caseId} W5 coverage $${covered.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  return [{ caseId: input.caseId, arm: "W5-coverage", costUsd: covered.costUsd }];
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
  allow: (label: string) => boolean;
}): Promise<{ draft: TailorOutput; calls: SpendCall[] }> {
  const calls: SpendCall[] = [];
  const first = replayDraft({ draft: input.draft, snapshot: input.library.snapshot, analysis: input.library.analysis, mode: "C" });
  const moved = moveWrongEntry(input.draft, first.flags);
  const draft = moved.draft;
  const afterMove = replayDraft({ draft, snapshot: input.library.snapshot, analysis: input.library.analysis, mode: "C" });
  const fixable = afterMove.flags.filter((flag) => flag.code !== "wrong-entry");
  if (fixable.length === 0 || !input.allow(`${input.caseId} W5 fix`)) return { draft, calls };
  const records = flagRecords(draft, fixable, input.library.snapshot);
  const fixed = await callTailor({
    userId: input.userId,
    system: fixPrompt(),
    userMessage: fixMessage({ flags: records }),
    schema: FixSchema,
    refId: `bench:${input.caseId}:w5:fix:${randomUUID()}`,
  });
  input.ledger.spent += fixed.costUsd;
  calls.push({ caseId: input.caseId, arm: "W5-fix", costUsd: fixed.costUsd });
  writeFileSync(path.join(input.directory, `${input.caseId}.W5.fix.call.json`), JSON.stringify(fixed, null, 2));
  const replacements = fixed.ok ? FixSchema.safeParse(fixed.data).data?.replacements ?? [] : [];
  const replaced = applyReplacements(draft, replacements);
  const again = replayDraft({ draft: replaced, snapshot: input.library.snapshot, analysis: input.library.analysis, mode: "C" });
  const dropped = dropFlagged(replaced, again.flags.filter((flag) => flag.code !== "wrong-entry"));
  console.log(`${input.caseId} W5 fix $${fixed.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
  return { draft: dropped.draft, calls };
}

async function draftW5(caseId: string, userId: string, library: Ready): Promise<{ call: SavedCall; draft: TailorOutput | null }> {
  const message = writeVerifyMessage(library.snapshot, library.job);
  const call = await callTailor({
    userId,
    system: writeVerifyW4Prompt(),
    userMessage: message.text,
    schema: WriteSchema,
    normalize: normalizeWriteDraft,
    refId: `bench:${caseId}:w5:${randomUUID()}`,
  });
  if (!call.ok) return { call, draft: null };
  const parsed = WriteSchema.safeParse(call.data);
  return { call, draft: parsed.success ? writeDraftToTailor(parsed.data) : null };
}

function writeVariant(directory: string, caseId: string, draft: TailorOutput, library: Ready): void {
  const replay = replayDraft({ draft, snapshot: library.snapshot, analysis: library.analysis, mode: "C" });
  writeFileSync(
    path.join(directory, `${caseId}.W5.fit-input.json`),
    JSON.stringify({ role: { content: replay.content, snapshot: library.snapshot }, baseline: null, job: library.job, draft }),
  );
}

async function cutToOnePage(input: {
  directory: string;
  userId: string;
  ledger: { spent: number };
  allow: (label: string) => boolean;
}): Promise<SpendCall[]> {
  const calls: SpendCall[] = [];
  const history = new Map<string, { round: number; pagesBefore: number; reason: string; log: unknown }[]>();
  for (let round = 1; round <= 3; round += 1) {
    fitDirectory(input.directory, "present-count");
    const files = readdirSync(input.directory).filter((name) => name.endsWith(".W5.fit-input.json"));
    let overflowing = 0;
    for (const name of files) {
      const stem = name.replace(/\.fit-input\.json$/, "");
      const pages = readPages(input.directory, stem);
      if (pages === null || pages <= 1) continue;
      overflowing += 1;
      if (!input.allow(`${stem} page cut ${round}`)) continue;
      const fitPath = path.join(input.directory, name);
      const saved = JSON.parse(readFileSync(fitPath, "utf8")) as {
        role: { content: ResumeContent; snapshot: LibrarySnapshot };
        job?: string;
        draft?: TailorOutput;
      };
      const lines = includedCutLines(saved.role.content);
      if (lines.length === 0) continue;
      const call = await callTailor({
        userId: input.userId,
        system: cutW5Prompt(),
        userMessage: cutMessage(lines, saved.job ?? ""),
        schema: CutW5Schema,
        normalize: normalizeCutW5,
        refId: `bench:${stem}:cut:${round}:${randomUUID()}`,
      });
      input.ledger.spent += call.costUsd;
      const caseId = stem.split(".")[0] ?? stem;
      calls.push({ caseId, arm: "W5-cut", costUsd: call.costUsd });
      const reply = call.ok ? CutW5Schema.safeParse(call.data).data : undefined;
      const applied = reply ? applyW5Cut(saved.role.content, saved.role.snapshot, reply) : null;
      if (applied) saved.role.content = applied.content;
      writeFileSync(fitPath, JSON.stringify(saved));
      const attempt = {
        round,
        pagesBefore: pages,
        reason: reply?.reason ?? "",
        log: applied?.log ?? { dropped: [], merged: [], refused: ["no reply"], reason: "" },
      };
      const prior = history.get(stem) ?? [];
      prior.push(attempt);
      history.set(stem, prior);
      console.log(`${stem} cut ${round} $${call.costUsd.toFixed(4)}. Total $${input.ledger.spent.toFixed(4)}.`);
    }
    if (overflowing === 0) break;
  }
  for (const [stem, attempts] of history) {
    writeFileSync(path.join(input.directory, `${stem}.cuts.json`), JSON.stringify({ attempts }, null, 2));
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
    const arm = path.join(directory, `${caseId}.W5.pdf`);
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
    const job = caseId.split("-")[1];
    const candidate = caseId.split("-")[0];
    copyFileSync(path.join(process.cwd(), "benchmarks", "fixtures", "jobs", `${job}.md`), path.join(folder, "posting.md"));
    copyFileSync(
      path.join(process.cwd(), "benchmarks", "fixtures", "candidates", candidate ?? "", "original-resume.txt"),
      path.join(folder, "original-resume.txt"),
    );
    key.push({ caseId, A: armFirst ? "W5" : "direct", B: armFirst ? "direct" : "W5" });
  }
  writeFileSync(path.join(directory, "key.json"), JSON.stringify({ runId, cases: key }, null, 2));
}

function fitDirectory(directory: string, mode: "present-count" | "w5mix"): void {
  const ran = spawnSync("npx", ["vitest", "run", "tests/unit/benchmark-fit-saved.test.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, BENCHMARK_FIT_DIR: directory, BENCHMARK_FIT_MODE: mode, BENCHMARK_WRITE_PDF: mode === "w5mix" ? "1" : "" },
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
  const w4 = JSON.parse(readFileSync(path.join(W4_RUN, "metrics.json"), "utf8")) as { rows: unknown[]; saved?: unknown };
  const rows = [];
  for (const caseId of EXPERIMENT_CASES) {
    const library = ready.get(caseId);
    const bullets = library?.libraryBullets ?? [];
    const items = lists[caseId] ?? [];
    const fitted = readFitted(directory, caseId, "W5");
    const coverage = mustKeepScore(fitted.text, items);
    const cuts = readCuts(directory, caseId);
    rows.push({
      caseId,
      variant: "W5",
      ...coverage,
      rate: coverage.total === 0 ? 0 : coverage.kept / coverage.total,
      defects: readerDefects(fitted.text, bullets),
      pages: fitted.pageLimit,
      fitterRemoved: fitted.dropped,
      fitterNote: fitted.note,
      words: fitted.text.split(/\s+/).filter((word) => word.length > 0).length,
      cuts,
    });
  }
  return { rows, w4: w4.rows, saved: w4.saved };
}

function readCuts(directory: string, caseId: string): unknown {
  try {
    return JSON.parse(readFileSync(path.join(directory, `${caseId}.W5.cuts.json`), "utf8"));
  } catch {
    return { attempts: [] };
  }
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
