/**
 * Step 2. Run the meaning check on the saved W2 pages and the saved direct
 * pages. No drafts. No fixes. The result decides whether W3 continues.
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeContent } from "@/features/tailor/schemas";

import { callTailor } from "../lib/model-call";
import { EXPERIMENT_CASES } from "./estimate";
import {
  contentLines,
  extraFlags,
  goldFor,
  MeaningSchema,
  meaningMessage,
  meaningPrompt,
  normalizeMeaning,
  plainLines,
  scoreGold,
  type MeaningFlag,
  type VerifyLine,
} from "./verify-meaning";

const W2_RUN = path.join(process.cwd(), "benchmarks", "results", "write-verify-w2-2026-11-14T21-29-55-169Z");
const OUTPUT_CAP = 1200;
const SONNET_IN = 2;
const SONNET_OUT = 10;

export function estimateCalibration(): { usd: number; lines: { id: string; arm: string; inputTokens: number }[] } {
  const lines = EXPERIMENT_CASES.flatMap((caseId) => {
    const w2 = contentLines(loadFitted(caseId).content, loadFitted(caseId).snapshot);
    const direct = plainLines(readFileSync(path.join(W2_RUN, `${caseId}.direct.txt`), "utf8"), originalResume(caseId));
    return [
      { id: caseId, arm: "W2", inputTokens: tokens(w2) },
      { id: caseId, arm: "direct", inputTokens: tokens(direct) },
    ];
  });
  const usd = lines.reduce((sum, line) => sum + (line.inputTokens * SONNET_IN + OUTPUT_CAP * SONNET_OUT) / 1_000_000, 0);
  return { usd, lines };
}

export async function runCalibration(input: { maxUsd: number }): Promise<string> {
  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY. No request was sent.");
  if (!userId) throw new Error("Set SEED_USER_ID. No request was sent.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("No User row for SEED_USER_ID. No request was sent.");

  const runId = `write-verify-w3-cal-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(process.cwd(), "benchmarks", "results", runId);
  mkdirSync(directory, { recursive: false });
  let spent = 0;
  const system = meaningPrompt();
  const rows: {
    caseId: string;
    arm: "W2" | "direct";
    lines: number;
    flags: MeaningFlag[];
    missed: string[];
    extras: MeaningFlag[];
    hit: number;
    gold: number;
    costUsd: number;
  }[] = [];

  for (const caseId of EXPERIMENT_CASES) {
    for (const arm of ["W2", "direct"] as const) {
      if (spent + 0.04 > input.maxUsd) {
        throw new Error(`Stopping before ${caseId} ${arm}. Spent $${spent.toFixed(4)}.`);
      }
      const verifyLines = arm === "W2" ? w2Lines(caseId) : plainLines(readFileSync(path.join(W2_RUN, `${caseId}.direct.txt`), "utf8"), originalResume(caseId));
      const call = await callTailor({
        userId,
        system,
        userMessage: meaningMessage(verifyLines),
        schema: MeaningSchema,
        normalize: normalizeMeaning,
        refId: `bench:${caseId}:w3:verify:${arm}:${randomUUID()}`,
      });
      spent += call.costUsd;
      writeFileSync(path.join(directory, `${caseId}.${arm}.verify.json`), JSON.stringify(call, null, 2));
      const flags = call.ok ? MeaningSchema.safeParse(call.data).data?.flags ?? [] : [];
      const gold = goldFor(arm);
      const scored = scoreGold(caseId, flags, gold);
      rows.push({
        caseId,
        arm,
        lines: verifyLines.length,
        flags,
        missed: scored.missed,
        extras: extraFlags(caseId, flags, gold),
        hit: scored.hit.filter(Boolean).length,
        gold: scored.hit.length,
        costUsd: call.costUsd,
      });
      console.log(`${caseId} ${arm} $${call.costUsd.toFixed(4)}. Flags ${flags.length}. Missed ${scored.missed.length}. Total $${spent.toFixed(4)}.`);
    }
  }

  const w2 = rows.filter((row) => row.arm === "W2");
  const direct = rows.filter((row) => row.arm === "direct");
  const summary = {
    runId,
    spentUsd: spent,
    w2Hit: w2.reduce((sum, row) => sum + row.hit, 0),
    w2Gold: 12,
    directHit: direct.reduce((sum, row) => sum + row.hit, 0),
    directGold: 19,
    lines: rows.reduce((sum, row) => sum + row.lines, 0),
    rows: rows.map((row) => ({
      caseId: row.caseId,
      arm: row.arm,
      lines: row.lines,
      hit: row.hit,
      gold: row.gold,
      missed: row.missed,
      extras: row.extras,
      costUsd: row.costUsd,
    })),
  };
  writeFileSync(path.join(directory, "calibration.json"), JSON.stringify(summary, null, 2));
  console.log(
    `Recall W2 ${summary.w2Hit}/12, direct ${summary.directHit}/19, combined ${summary.w2Hit + summary.directHit}/31. Saved benchmarks/results/${runId}.`,
  );
  return directory;
}

function tokens(lines: readonly VerifyLine[]): number {
  return Math.ceil((meaningPrompt().length + meaningMessage(lines).length) / 4);
}

function w2Lines(caseId: string): VerifyLine[] {
  const loaded = loadFitted(caseId);
  return contentLines(loaded.content, loaded.snapshot);
}

function loadFitted(caseId: string): { content: ResumeContent; snapshot: LibrarySnapshot } {
  const fitted = JSON.parse(readFileSync(path.join(W2_RUN, `${caseId}.W2.fitted.json`), "utf8")) as {
    role?: { content?: ResumeContent };
  };
  const input = JSON.parse(readFileSync(path.join(W2_RUN, `${caseId}.W2.fit-input.json`), "utf8")) as {
    role?: { content?: ResumeContent; snapshot?: LibrarySnapshot };
  };
  const content = fitted.role?.content ?? input.role?.content;
  const snapshot = input.role?.snapshot;
  if (!content || !snapshot) throw new Error(`Missing saved W2 resume for ${caseId}.`);
  return { content, snapshot };
}

function originalResume(caseId: string): string {
  const candidate = caseId.split("-")[0] ?? caseId;
  return readFileSync(path.join(process.cwd(), "benchmarks", "fixtures", "candidates", candidate, "original-resume.txt"), "utf8");
}
