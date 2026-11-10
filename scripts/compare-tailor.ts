/**
 * Local before/after for the evidence-driven tailor.
 * Prints resume text. Does not save a resume or a job.
 * Docs/05-AI.md → Evals.
 *
 * npx tsx --conditions=react-server scripts/compare-tailor.ts
 * Page count needs the Vitest loader, which can render the PDF:
 * LIVE_TAILOR=1 npx vitest run tests/unit/live-compare.test.ts
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";

import { postProcessAnalyze } from "@/features/jobs/analyze";
import { JobAnalysis } from "@/features/jobs/schemas";
import { LibrarySnapshot, type LibrarySnapshot as Snapshot } from "@/features/library/schemas";
import { libraryPromptText } from "@/features/library/serialize";
import { assembleResumeContent } from "@/features/tailor/assemble";
import { composeResume } from "@/features/tailor/compose";
import { sameRoleText } from "@/features/tailor/stints";
import { TailorOptions } from "@/features/tailor/schemas";
import { resumePlainText } from "@/features/tailor/plainText";
import {
  applyAcceptedRepairs,
  countRevertedBullets,
  mergeRepair,
  repairTargets,
} from "@/features/tailor/repair";
import { acceptRevision, mergeRevision, notesForAccepted, revisionTargets } from "@/features/tailor/revise";
import { ResumeContent } from "@/features/tailor/schemas";
import { validateTailorOutput } from "@/features/tailor/validate";
import { preferSavedWording } from "@/features/tailor/variants";
import {
  buildContent as buildAnalyzeContent,
  OutputSchema as AnalyzeSchema,
  SYSTEM as ANALYZE_SYSTEM,
} from "@/lib/ai/prompts/analyze";
import {
  buildRepairContent,
  RepairSchema,
  REPAIR_SYSTEM,
} from "@/lib/ai/prompts/tailor-repair";
import {
  buildReviseContent,
  ReviseSchema,
  REVISE_SYSTEM,
} from "@/lib/ai/prompts/tailor-revise";
import {
  buildContent as buildTailorContent,
  OutputSchema as TailorSchema,
  SYSTEM as TAILOR_SYSTEM,
} from "@/lib/ai/prompts/tailor";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { ANALYST_POSTING, HOOTSUITE_POSTING } from "../tests/unit/hootsuite-posting";

const PREVIOUS_RESUME_ID = "e60b1950-2235-42af-8904-375ac828b5e9";

type CallRow = {
  label: string;
  kind: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  durationMs: number;
  success: boolean;
};

async function main() {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("Set ANTHROPIC_API_KEY in .env. No model call was made.");
  }

  const previous = await db.tailoredResume.findFirst({
    where: { id: PREVIOUS_RESUME_ID },
    include: { job: true },
  });
  if (!previous?.librarySnapshot || !previous.content || !previous.job) {
    throw new Error("The previous Hootsuite resume was not found, so no model call was made.");
  }

  const snapshot = LibrarySnapshot.parse(previous.librarySnapshot);
  const saved = ResumeContent.parse(previous.content);
  const posting = postingBody(previous.job.rawText);
  console.log("PREVIOUS SAVED RESUME");
  console.log(`resume ${previous.id} version ${previous.version} reverts ${previous.guardReverts}`);
  console.log(resumePlainText(saved, snapshot));
  console.log("");

  const priorCalls = await db.aiCall.findMany({
    where: { refId: previous.id },
    orderBy: { createdAt: "asc" },
    select: {
      kind: true,
      inputTokens: true,
      outputTokens: true,
      costMicros: true,
      durationMs: true,
      success: true,
    },
  });
  console.log("PREVIOUS CALLS");
  for (const call of priorCalls) printCall({ label: "saved", ...call });
  console.log("");

  const libraryText = libraryPromptText(snapshot);
  const length = TailorOptions.parse(previous.options).length;
  const hootsuite = await tailorPosting({
    userId: previous.userId,
    snapshot,
    libraryText,
    posting,
    fallbackTitle: previous.job.title,
    fallbackCompany: previous.job.company,
    length,
  });
  console.log("NEW HOOTSUITE RESUME");
  printRun(hootsuite);
  console.log("");

  const analyst = await tailorPosting({
    userId: previous.userId,
    snapshot,
    libraryText,
    posting: ANALYST_POSTING,
    fallbackTitle: "Reporting Analyst",
    fallbackCompany: "Northwind",
    length,
  });
  console.log("NEW REPORTING ANALYST RESUME");
  printRun(analyst);
}

function postingBody(raw: string): string {
  const about = raw.split("About the job\n").at(-1)?.trim();
  if (about && about.includes("Experience with Java or a functional programming language")) {
    return about;
  }
  return HOOTSUITE_POSTING;
}

async function tailorPosting(input: {
  userId: string;
  snapshot: Snapshot;
  libraryText: string;
  posting: string;
  fallbackTitle: string;
  fallbackCompany: string;
  length: 1 | 2;
}): Promise<{
  text: string;
  issues: { code: string; ref: string }[];
  reverts: number;
  calls: CallRow[];
  requirements: string[];
  pages: number;
}> {
  const calls: CallRow[] = [];
  const analyzed = await tracked("analyze", (refId) =>
    runStructured({
      kind: "ANALYZE",
      userId: input.userId,
      usedBonusCredit: false,
      countsTowardQuota: false,
      system: ANALYZE_SYSTEM,
      content: buildAnalyzeContent(input.posting),
      schema: AnalyzeSchema,
      refId,
    }),
  );
  calls.push(analyzed.call);
  if (!analyzed.result.ok) {
    return {
      text: `Analysis failed: ${analyzed.result.code}`,
      issues: [],
      reverts: 0,
      calls,
      requirements: [],
      pages: 0,
    };
  }
  const analysis = postProcessAnalyze(analyzed.result.data, input.posting);
  const checked = JobAnalysis.safeParse(analysis);
  if (!checked.success) {
    return { text: "Analysis did not match the schema.", issues: [], reverts: 0, calls, requirements: [], pages: 0 };
  }

  const generated = await tracked("generate", (refId) =>
    runStructured({
      kind: "TAILOR",
      userId: input.userId,
      usedBonusCredit: false,
      countsTowardQuota: false,
      system: TAILOR_SYSTEM,
      content: buildTailorContent({
        libraryText: input.libraryText,
        title: checked.data.title || input.fallbackTitle,
        company: checked.data.company || input.fallbackCompany,
        seniority: checked.data.seniority,
        requirements: checked.data.requirements,
        keywords: checked.data.keywords,
        posting: input.posting,
        length: input.length,
        emphasis: null,
        sameRole: sameRoleText(input.snapshot.entries, input.snapshot.takenAt),
      }),
      schema: TailorSchema,
      refId,
    }),
  );
  calls.push(generated.call);
  if (!generated.result.ok) {
    return {
      text: `Tailor failed: ${generated.result.code}`,
      issues: [],
      reverts: 0,
      calls,
      requirements: checked.data.requirements.map((item) => item.text),
      pages: 0,
    };
  }

  const prepared = preferSavedWording(generated.result.data, [], input.snapshot);
  let guard = validateTailorOutput(prepared.output, input.snapshot, checked.data);
  let notes = prepared.why;
  const repairs = repairTargets(prepared.output, guard, input.snapshot);
  if (repairs.length > 0) {
    const repair = await tracked("repair", (refId) =>
      runStructured({
        kind: "TAILOR",
        userId: input.userId,
        usedBonusCredit: false,
        countsTowardQuota: false,
        system: REPAIR_SYSTEM,
        content: buildRepairContent({
          title: checked.data.title || input.fallbackTitle,
          company: checked.data.company || input.fallbackCompany,
          requirements: checked.data.requirements,
          targets: repairs,
        }),
        schema: RepairSchema,
        refId,
      }),
    );
    calls.push(repair.call);
    const parsed = repair.result.ok ? RepairSchema.safeParse(repair.result.data) : null;
    if (parsed?.success) {
      const merged = mergeRepair(prepared.output, parsed.data.bullets, repairs);
      const second = validateTailorOutput(merged, input.snapshot, checked.data);
      const chosen = applyAcceptedRepairs(guard.output, second.output, repairs);
      if (chosen.accepted.length > 0) {
        const summaryReverts = Math.max(0, guard.reverts - countRevertedBullets(guard.output));
        guard = {
          output: chosen.output,
          reverts: summaryReverts + countRevertedBullets(chosen.output),
          issues: guard.issues,
        };
      }
    }
  }

  const gaps = revisionTargets({
    output: guard.output,
    snapshot: input.snapshot,
    analysis: checked.data,
  });
  if (gaps.length > 0) {
    const revised = await tracked("revision", (refId) =>
      runStructured({
        kind: "TAILOR",
        userId: input.userId,
        usedBonusCredit: false,
        countsTowardQuota: false,
        system: REVISE_SYSTEM,
        content: buildReviseContent({
          title: checked.data.title || input.fallbackTitle,
          company: checked.data.company || input.fallbackCompany,
          targets: gaps,
        }),
        schema: ReviseSchema,
        refId,
      }),
    );
    calls.push(revised.call);
    if (revised.result.ok) {
      const merged = mergeRevision(guard.output, revised.result.data.entries, gaps);
      const second = validateTailorOutput(merged.output, input.snapshot, checked.data);
      const chosen = acceptRevision(
        guard.output,
        second.output,
        gaps.map((target) => target.entryRef),
      );
      if (chosen.accepted.length > 0) {
        const summaryReverts = Math.max(0, guard.reverts - countRevertedBullets(guard.output));
        guard = {
          output: chosen.output,
          reverts: summaryReverts + countRevertedBullets(chosen.output),
          issues: guard.issues,
        };
        notes = notesForAccepted(notes, merged.notes, chosen.accepted, chosen.output);
      }
    }
  }

  const composition = composeResume({
    output: guard.output,
    snapshot: input.snapshot,
    analysis: checked.data,
    length: input.length,
  });
  const assembled = assembleResumeContent(
    composition.output,
    input.snapshot,
    () => randomUUID(),
    notes,
    composition,
  );
  const fitted = await fitPages(assembled, input.snapshot, input.length);
  return {
    text: resumePlainText(fitted.content, input.snapshot),
    issues: guard.issues,
    reverts: guard.reverts,
    calls,
    requirements: checked.data.requirements.map((item) => `[${item.importance}] ${item.text}`),
    pages: fitted.pages,
  };
}

async function fitPages(
  content: Awaited<ReturnType<typeof assembleResumeContent>>,
  snapshot: Snapshot,
  pages: 1 | 2,
): Promise<{ content: Awaited<ReturnType<typeof assembleResumeContent>>; pages: number }> {
  const [{ enforcePageBudget }, { resumePdfModel }, { fitResumePdf }] = await Promise.all([
    import("@/features/tailor/page-fit"),
    import("@/lib/pdf/model"),
    import("@/lib/pdf/render"),
  ]);
  const fitted = await enforcePageBudget(content, snapshot, pages);
  const fit = await fitResumePdf(resumePdfModel(fitted, snapshot), "classic");
  return { content: fitted, pages: fit.pageCount };
}

async function tracked<T>(
  label: string,
  run: (refId: string) => Promise<T>,
): Promise<{ result: T; call: CallRow }> {
  const refId = `compare-${randomUUID()}`;
  const started = new Date();
  const result = await run(refId);
  const row = await db.aiCall.findFirst({
    where: { refId, createdAt: { gte: started } },
    orderBy: { createdAt: "desc" },
    select: {
      kind: true,
      inputTokens: true,
      outputTokens: true,
      costMicros: true,
      durationMs: true,
      success: true,
    },
  });
  return {
    result,
    call: {
      label,
      kind: row?.kind ?? "UNKNOWN",
      inputTokens: row?.inputTokens ?? 0,
      outputTokens: row?.outputTokens ?? 0,
      costMicros: row?.costMicros ?? 0,
      durationMs: row?.durationMs ?? 0,
      success: row?.success ?? false,
    },
  };
}

function printRun(run: {
  text: string;
  issues: { code: string; ref: string }[];
  reverts: number;
  calls: CallRow[];
  requirements: string[];
  pages: number;
}) {
  console.log("REQUIREMENTS");
  for (const requirement of run.requirements) console.log(`- ${requirement}`);
  console.log("CALLS");
  for (const row of run.calls) printCall(row);
  const cost = run.calls.reduce((sum, row) => sum + row.costMicros, 0);
  console.log(
    `reverts ${run.reverts} issues ${JSON.stringify(run.issues)} pages ${run.pages} costUSD ${(cost / 1_000_000).toFixed(4)}`,
  );
  console.log(run.text);
}

function printCall(row: CallRow) {
  console.log(
    `${row.label} ${row.kind} in ${row.inputTokens} out ${row.outputTokens} costUSD ${(row.costMicros / 1_000_000).toFixed(4)} ms ${row.durationMs} ok ${row.success}`,
  );
}

const invokedDirectly = process.argv.some((arg) => arg.includes("compare-tailor.ts"));
if (invokedDirectly) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Comparison failed.";
    console.error(message);
    process.exitCode = 1;
  });
}

export { main };
