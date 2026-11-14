/**
 * Paid comparison. Called only after the spend gate. Each model call is
 * charged to the provider and marked countsTowardQuota: false.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { postProcessAnalyze } from "@/features/jobs/analyze";
import { JobAnalysis } from "@/features/jobs/schemas";
import { assembleResumeContent } from "@/features/tailor/assemble";
import { composeResume } from "@/features/tailor/compose";
import { resumePlainText } from "@/features/tailor/plainText";
import {
  applyAcceptedRepairs,
  countRevertedBullets,
  mergeRepair,
  repairTargets,
} from "@/features/tailor/repair";
import {
  acceptEditorial,
  acceptRevision,
  editorialLibrary,
  mergeRevision,
  notesForAccepted,
  notesForEditorial,
  revisionRoute,
} from "@/features/tailor/revise";
import { sameRoleText } from "@/features/tailor/stints";
import { validateTailorOutput } from "@/features/tailor/validate";
import { planDispositions } from "@/features/tailor/plan-completeness";
import { preferSavedWording } from "@/features/tailor/variants";
import type { FittedResume } from "./fit";
import { baselineDocument } from "./plain-resume";
import { prepareEvidence } from "./evidence";
import { phraseEquivalent, phraseMatch, type PhraseMatch } from "./phrases";
import { blindPacket } from "./blind";
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
  buildEditorialContent,
  buildReviseContent,
  EDITORIAL_SYSTEM,
  EditorialSchema,
  ReviseSchema,
  REVISE_SYSTEM,
} from "@/lib/ai/prompts/tailor-revise";
import {
  buildContent as buildTailorContent,
  normalizeTailorOutput,
  OutputSchema as TailorSchema,
  SYSTEM as TAILOR_SYSTEM,
} from "@/lib/ai/prompts/tailor";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { benchmarkRoot, equalEvidenceInput, groundTruth, loadCase } from "./load";
import type { BenchmarkCase } from "./types";

const BaselineSchema = z.object({
  resume: z.string(),
});

const CALL_RESERVE_USD = 0.35;

type CallCost = {
  label: string;
  usd: number;
  inputTokens: number;
  outputTokens: number;
};

type PipelineTrace = {
  import: string;
  pageFit: string;
  normalizedEntries: { ref: string; kind: string; title: string; bullets: string[] }[];
  omissions: { ref: string; because: string }[];
  phrases: { phrase: string; source: boolean; library: boolean; composed: PhraseMatch; fitted: PhraseMatch }[];
  fitted: { roleRefine: FittedResume; baseline: FittedResume } | null;
  composedText: { roleRefine: string; baseline: string } | null;
  analysis: unknown;
  plan: unknown;
  requirementMatches: unknown[];
  guard: { reverts: number; issues: { code: string; ref: string }[] } | null;
  repair: { called: boolean; accepted: string[] };
  revisionRoute: unknown;
  editorial: { called: boolean; applied: boolean };
  revision: { called: boolean; accepted: string[] };
  composeReview: { code: string; severity: string; ref: string; reason: string }[];
  entriesBeforeCompose: { ref: string; bullets: string[] }[];
  entriesAfterCompose: { ref: string; bullets: string[] }[];
  spans: { label: string; outcome: string; material: boolean; ref: string | null; characters: number; note: string }[];
  dispositions: { ref: string; disposition: string }[];
};

export async function runPaidCases(input: { caseIds: string[]; maxUsd: number }): Promise<void> {
  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY. No request was sent.");
  if (!userId) throw new Error("Set SEED_USER_ID. No request was sent.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("No User row for SEED_USER_ID. No request was sent.");

  const runId = `paid-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(benchmarkRoot(), "results", runId);
  mkdirSync(directory, { recursive: true });
  let spent = 0;
  const finished: string[] = [];
  const held: {
    caseId: string;
    testCase: BenchmarkCase;
    result: Awaited<ReturnType<typeof runCase>>;
  }[] = [];

  for (const caseId of input.caseIds) {
    const testCase = loadCase(caseId);
    if (!testCase) throw new Error(`Unknown case ${caseId}.`);
    if (spent + CALL_RESERVE_USD > input.maxUsd) {
      console.log(`Stopping. Spent $${spent.toFixed(4)} and the next call could pass $${input.maxUsd.toFixed(2)}.`);
      break;
    }
    console.log(`Running ${caseId}. Spent so far $${spent.toFixed(4)}.`);
    const result = await runCase({
      testCase,
      userId,
      maxUsd: input.maxUsd,
      spent: () => spent,
      add: (usd) => {
        spent += usd;
      },
    });
    writeFileSync(
      path.join(directory, `${caseId}.fit-input.json`),
      JSON.stringify({ role: result.roleFitInput, baseline: result.baselineFitInput }),
    );
    writeFileSync(path.join(directory, `${caseId}.trace.json`), JSON.stringify(result.trace, null, 2));
    finished.push(caseId);
    held.push({ caseId, testCase, result });
    console.log(`${caseId} done. Case cost $${result.costUsd.toFixed(4)}. Total $${spent.toFixed(4)}.`);
  }

  const fittedByCase = fitSavedCases(directory);
  for (const item of held) {
    const fitted = fittedByCase.get(item.caseId) ?? null;
    const roleText = fitted?.role.measured ? fitted.role.text : item.result.roleRefine;
    const baselineText = fitted?.baseline.measured ? fitted.baseline.text : item.result.baseline;
    item.result.trace.fitted = fitted
      ? { roleRefine: fitted.role, baseline: fitted.baseline }
      : null;
    item.result.trace.pageFit = fitted
      ? `RoleRefine: ${fitted.role.note} Baseline: ${fitted.baseline.note}`
      : "Page fit did not run.";
    item.result.trace.phrases = item.result.trace.phrases.map((row) => ({
      ...row,
      fitted: phraseMatch(roleText, row.phrase),
    }));
    const report = `${renderReport({
      testCase: item.testCase,
      roleRefine: roleText,
      baseline: baselineText,
      reverts: item.result.reverts,
      issues: item.result.issues,
      calls: item.result.calls,
    })}\n${pipelineNotes(item.result.trace)}`;
    writeFileSync(path.join(directory, `${item.caseId}.json`), JSON.stringify({ costUsd: item.result.costUsd, report }, null, 2));
    writeFileSync(path.join(directory, `${item.caseId}.md`), report);
    writeFileSync(path.join(directory, `${item.caseId}.trace.json`), JSON.stringify(item.result.trace, null, 2));
    const evidence = equalEvidenceInput(item.testCase);
    const blinded = blindPacket({
      caseId: item.caseId,
      runId,
      job: evidence.job,
      originalResume: evidence.resume,
      roleRefine: roleText,
      baseline: baselineText,
      groundTruthFacts: supportedFacts(item.testCase.candidateId),
    });
    writeFileSync(path.join(directory, `${item.caseId}.blind.json`), JSON.stringify(blinded.packet, null, 2));
    writeFileSync(path.join(directory, `${item.caseId}.blind-key.json`), JSON.stringify(blinded.key, null, 2));
  }

  writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        runId,
        status: "paid",
        maxUsd: input.maxUsd,
        spentUsd: spent,
        caseIds: finished,
        note: "Traces store normalized entries, the editorial plan, guard, compose review, and page-fitted text for both arms. Phrase checks are not a winner. Rubric scores are not in this file.",
      },
      null,
      2,
    ),
  );
  console.log(`Saved benchmarks/results/${runId}. Total $${spent.toFixed(4)} of $${input.maxUsd.toFixed(2)}.`);
}

async function runCase(input: {
  testCase: BenchmarkCase;
  userId: string;
  maxUsd: number;
  spent: () => number;
  add: (usd: number) => void;
}): Promise<{
  costUsd: number;
  report: string;
  trace: PipelineTrace;
  roleRefine: string;
  baseline: string;
  reverts: number;
  issues: string[];
  calls: CallCost[];
  roleFitInput: { content: unknown; snapshot: unknown } | null;
  baselineFitInput: { content: unknown; snapshot: unknown } | null;
}> {
  const source = JSON.parse(
    readFileSync(path.join(benchmarkRoot(), "fixtures", "jobs", `${input.testCase.jobId}.source.json`), "utf8"),
  ) as { title: string; company: string };
  const prepared = prepareEvidence(input.testCase);
  const evidence = prepared.evidence;
  const adapted = prepared.adapted;
  const snapshot = adapted.snapshot;
  const libraryText = prepared.libraryText;
  const calls: CallCost[] = [];
  const trace: PipelineTrace = {
    import:
      "Production career normalization built the library. The import model was not called. Material source text was still in the snapshot.",
    normalizedEntries: snapshot.entries.map((entry) => ({
      ref: entry.ref,
      kind: entry.kind,
      title: entry.title,
      bullets: entry.bullets.map((bullet) => bullet.text),
    })),
    omissions: [],
    phrases: [],
    fitted: null,
    composedText: null,
    spans: adapted.spans.map((span) => ({
      label: span.label,
      outcome: span.outcome,
      material: span.material,
      ref: span.ref,
      characters: span.text.length,
      note: span.note,
    })),
    dispositions: [],
    pageFit: "Not run. The result is composed plain text, not a PDF.",
    analysis: null,
    plan: null,
    requirementMatches: [],
    guard: null,
    repair: { called: false, accepted: [] },
    revisionRoute: null,
    editorial: { called: false, applied: false },
    revision: { called: false, accepted: [] },
    composeReview: [],
    entriesBeforeCompose: [],
    entriesAfterCompose: [],
  };

  const charge = async (label: string, refId: string) => {
    const row = await db.aiCall.findFirst({
      where: { refId },
      orderBy: { createdAt: "desc" },
      select: { costMicros: true, inputTokens: true, outputTokens: true },
    });
    const usd = (row?.costMicros ?? 0) / 1_000_000;
    input.add(usd);
    calls.push({
      label,
      usd,
      inputTokens: row?.inputTokens ?? 0,
      outputTokens: row?.outputTokens ?? 0,
    });
  };

  const allow = () => {
    if (input.spent() + CALL_RESERVE_USD > input.maxUsd) {
      throw new Error(`Stopping ${input.testCase.id} before a call that could exceed $${input.maxUsd.toFixed(2)}.`);
    }
  };

  allow();
  const analyzeRef = `bench:${input.testCase.id}:analyze:${randomUUID()}`;
  const analyzed = await runStructured({
    kind: "ANALYZE",
    userId: input.userId,
    usedBonusCredit: false,
    countsTowardQuota: false,
    system: ANALYZE_SYSTEM,
    content: buildAnalyzeContent(evidence.job),
    schema: AnalyzeSchema,
    refId: analyzeRef,
  });
  await charge("analyze", analyzeRef);

  let roleRefine = "RoleRefine did not produce a resume.";
  let composedRole = "";
  let roleFitInput: { content: unknown; snapshot: unknown } | null = null;
  let reverts = 0;
  const issues: string[] = [];
  if (analyzed.ok) {
    const analysis = JobAnalysis.safeParse(postProcessAnalyze(analyzed.data, evidence.job));
    if (analysis.success) {
      trace.analysis = {
        title: analysis.data.title,
        company: analysis.data.company,
        seniority: analysis.data.seniority,
        requirements: analysis.data.requirements.map((item) => ({
          id: item.id,
          importance: item.importance,
          kind: item.kind,
          text: item.text,
        })),
      };
      allow();
      const tailorRef = `bench:${input.testCase.id}:tailor:${randomUUID()}`;
      const generated = await runStructured({
        kind: "TAILOR",
        userId: input.userId,
        usedBonusCredit: false,
        countsTowardQuota: false,
        system: TAILOR_SYSTEM,
        content: buildTailorContent({
          libraryText,
          title: analysis.data.title || source.title,
          company: analysis.data.company || source.company,
          seniority: analysis.data.seniority,
          requirements: analysis.data.requirements,
          keywords: analysis.data.keywords,
          posting: evidence.job,
          length: "auto",
          emphasis: null,
          sameRole: sameRoleText(snapshot.entries, snapshot.takenAt),
        }),
        schema: TailorSchema,
        normalize: normalizeTailorOutput,
        refId: tailorRef,
      });
      await charge("tailor", tailorRef);
      if (generated.ok) {
        const prepared = preferSavedWording(generated.data, [], snapshot);
        trace.plan = prepared.output.plan ?? null;
        trace.dispositions = planDispositions(snapshot.entries, prepared.output.plan?.evidence);
        trace.requirementMatches = prepared.output.requirementMatches.map((match) => ({
          requirementId: match.requirementId,
          verdict: match.verdict,
          evidenceRefs: [...match.evidenceRefs],
          note: match.note,
        }));
        let guard = validateTailorOutput(prepared.output, snapshot, analysis.data);
        let notes = prepared.why;
        const repairs = repairTargets(prepared.output, guard, snapshot);
        if (repairs.length > 0 && input.spent() + CALL_RESERVE_USD <= input.maxUsd) {
          trace.repair.called = true;
          const repairRef = `bench:${input.testCase.id}:repair:${randomUUID()}`;
          const repair = await runStructured({
            kind: "TAILOR",
            userId: input.userId,
            usedBonusCredit: false,
            countsTowardQuota: false,
            system: REPAIR_SYSTEM,
            content: buildRepairContent({
              title: analysis.data.title || source.title,
              company: analysis.data.company || source.company,
              requirements: analysis.data.requirements,
              targets: repairs,
            }),
            schema: RepairSchema,
            refId: repairRef,
          });
          await charge("repair", repairRef);
          const parsed = repair.ok ? RepairSchema.safeParse(repair.data) : null;
          if (parsed?.success) {
            const merged = mergeRepair(prepared.output, parsed.data.bullets, repairs);
            const second = validateTailorOutput(merged, snapshot, analysis.data);
            const chosen = applyAcceptedRepairs(guard.output, second.output, repairs);
            trace.repair = { called: true, accepted: chosen.accepted };
            if (chosen.accepted.length > 0) {
              guard = {
                output: chosen.output,
                reverts: Math.max(0, guard.reverts - countRevertedBullets(guard.output)) + countRevertedBullets(chosen.output),
                issues: guard.issues,
              };
            }
          }
        }
        const route = revisionRoute({ output: guard.output, snapshot, analysis: analysis.data });
        const routeTargets = route.kind === "none" ? [] : route.targets;
        trace.revisionRoute = {
          kind: route.kind,
          doubts: route.kind === "editorial" ? route.doubts : [],
          targets: routeTargets.map((target) => target.entryRef),
        };
        let editorialApplied = false;
        if (route.kind === "editorial" && guard.output.plan && input.spent() + CALL_RESERVE_USD <= input.maxUsd) {
          const editRef = `bench:${input.testCase.id}:editorial:${randomUUID()}`;
          const revised = await runStructured({
            kind: "TAILOR",
            userId: input.userId,
            usedBonusCredit: false,
            countsTowardQuota: false,
            system: EDITORIAL_SYSTEM,
            content: buildEditorialContent({
              title: analysis.data.title || source.title,
              company: analysis.data.company || source.company,
              length: "auto",
              strategy: guard.output.plan,
              doubts: route.doubts,
              draft: guard.output.entries.map((entry) => ({
                ref: entry.ref,
                bullets: entry.bullets.map((bullet) => ({ sourceRefs: bullet.sourceRefs, text: bullet.text })),
              })),
              library: editorialLibrary({ output: guard.output, snapshot, targets: route.targets }),
              sameRole: sameRoleText(snapshot.entries, snapshot.takenAt),
            }),
            schema: EditorialSchema,
            refId: editRef,
          });
          await charge("editorial", editRef);
          trace.editorial.called = true;
          const parsed = revised.ok ? EditorialSchema.safeParse(revised.data) : null;
          if (parsed?.success && parsed.data.changed) {
            const second = validateTailorOutput(
              {
                ...guard.output,
                summary: parsed.data.summary,
                entries: parsed.data.entries.map((entry) => ({
                  ref: entry.ref,
                  bullets: entry.bullets.map((bullet) => ({ sourceRefs: bullet.sourceRefs, text: bullet.text })),
                })),
                requirementMatches: guard.output.requirementMatches.map((match) => ({
                  requirementId: match.requirementId,
                  verdict: match.verdict === "unassessed" ? "missing" : match.verdict,
                  evidenceRefs: [...match.evidenceRefs],
                  note: match.note,
                })),
              },
              snapshot,
              analysis.data,
            );
            const chosen = acceptEditorial(guard.output, second.output);
            if (chosen.accepted && second.reverts <= guard.reverts) {
              editorialApplied = true;
              trace.editorial.applied = true;
              guard = { output: chosen.output, reverts: second.reverts, issues: second.issues };
              notes = notesForEditorial(notes, parsed.data.entries);
            }
          }
        }
        if (!editorialApplied && route.kind !== "none" && route.targets.length > 0 && input.spent() + CALL_RESERVE_USD <= input.maxUsd) {
          const reviseRef = `bench:${input.testCase.id}:revise:${randomUUID()}`;
          const revised = await runStructured({
            kind: "TAILOR",
            userId: input.userId,
            usedBonusCredit: false,
            countsTowardQuota: false,
            system: REVISE_SYSTEM,
            content: buildReviseContent({
              title: analysis.data.title || source.title,
              company: analysis.data.company || source.company,
              targets: route.targets,
            }),
            schema: ReviseSchema,
            refId: reviseRef,
          });
          await charge("revise", reviseRef);
          trace.revision.called = true;
          if (revised.ok) {
            const merged = mergeRevision(guard.output, revised.data.entries, route.targets);
            const second = validateTailorOutput(merged.output, snapshot, analysis.data);
            const chosen = acceptRevision(guard.output, second.output, route.targets.map((target) => target.entryRef));
            if (chosen.accepted.length > 0) {
              trace.revision.accepted = [...chosen.accepted];
              guard = {
                output: chosen.output,
                reverts: Math.max(0, guard.reverts - countRevertedBullets(guard.output)) + countRevertedBullets(chosen.output),
                issues: guard.issues,
              };
              notes = notesForAccepted(notes, merged.notes, chosen.accepted, chosen.output);
            }
          }
        }
        trace.guard = {
          reverts: guard.reverts,
          issues: guard.issues.map((issue) => ({ code: issue.code, ref: issue.ref })),
        };
        trace.entriesBeforeCompose = guard.output.entries.map((entry) => ({
          ref: entry.ref,
          bullets: entry.bullets.map((bullet) => bullet.text),
        }));
        const composition = composeResume({
          output: guard.output,
          snapshot,
          analysis: analysis.data,
          length: "auto",
        });
        trace.entriesAfterCompose = composition.output.entries.map((entry) => ({
          ref: entry.ref,
          bullets: entry.bullets.map((bullet) => bullet.text),
        }));
        trace.composeReview = composition.review.map((item) => ({
          code: item.code,
          severity: item.severity,
          ref: item.ref,
          reason: item.reason,
        }));
        const assembled = assembleResumeContent(composition.output, snapshot, randomUUID, notes, composition);
        composedRole = resumePlainText(assembled, snapshot);
        roleFitInput = { content: assembled, snapshot };
        roleRefine = composedRole;
        trace.pageFit = "Page fit runs after the model calls, in the same renderer as the app tests.";
        reverts = guard.reverts;
        issues.push(...guard.issues.map((issue) => `${issue.code} ${issue.ref}`));
      } else {
        roleRefine = `Tailor failed: ${generated.code}`;
      }
    } else {
      roleRefine = "Job analysis did not match the schema.";
    }
  } else {
    roleRefine = `Analysis failed: ${analyzed.code}`;
  }

  let baseline = "Baseline was not called.";
  if (input.spent() + CALL_RESERVE_USD <= input.maxUsd) {
    const prompt = readFileSync(path.join(benchmarkRoot(), "prompts", "direct-baseline-v1.md"), "utf8")
      .split("\n")
      .slice(2)
      .join("\n")
      .trim();
    const baselineRef = `bench:${input.testCase.id}:baseline:${randomUUID()}`;
    const written = await runStructured({
      kind: "TAILOR",
      userId: input.userId,
      usedBonusCredit: false,
      countsTowardQuota: false,
      system: prompt,
      content: [{ type: "text", text: `ORIGINAL RESUME:\n${evidence.resume}\n\nJOB DESCRIPTION:\n${evidence.job}` }],
      schema: BaselineSchema,
      refId: baselineRef,
    });
    await charge("baseline", baselineRef);
    baseline = written.ok ? written.data.resume : `Baseline failed: ${written.code}`;
  }

  const baselineFitInput = baseline.startsWith("Baseline") ? null : baselineDocument(baseline);
  trace.composedText = { roleRefine: composedRole, baseline };
  trace.fitted = null;
  trace.pageFit = "Page fit runs after the model calls, in the same renderer as the app tests.";
  const planRows = (
    trace.plan as { evidence?: { ref: string; use: string; because: string }[] } | null
  )?.evidence;
  trace.omissions = (planRows ?? [])
    .filter((row) => row.use === "omit")
    .map((row) => ({ ref: row.ref, because: row.because }));
  trace.phrases = input.testCase.includeEvidence.map((phrase) => ({
    phrase,
    source: phraseEquivalent(evidence.resume, phrase),
    library: phraseEquivalent(libraryText, phrase),
    composed: phraseMatch(composedRole, phrase),
    fitted: phraseMatch(composedRole, phrase),
  }));

  const report = renderReport({
    testCase: input.testCase,
    roleRefine,
    baseline,
    reverts,
    issues,
    calls,
  });
  return {
    costUsd: calls.reduce((sum, call) => sum + call.usd, 0),
    report: `${report}\n${pipelineNotes(trace)}`,
    trace,
    roleRefine,
    baseline,
    reverts,
    issues,
    calls,
    roleFitInput,
    baselineFitInput,
  };
}

function fitSavedCases(directory: string): Map<string, { role: FittedResume; baseline: FittedResume }> {
  const ran = spawnSync(
    "npx",
    ["vitest", "run", "tests/unit/benchmark-fit-saved.test.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env, BENCHMARK_FIT_DIR: directory },
      shell: true,
      encoding: "utf8",
    },
  );
  if (ran.status !== 0) {
    console.error(ran.stderr || ran.stdout || "Page fit did not complete.");
  }
  return readFittedCases(directory);
}

/** Every fitted file in the run, not a fixed case list. */
export function readFittedCases(directory: string): Map<string, { role: FittedResume; baseline: FittedResume }> {
  const fitted = new Map<string, { role: FittedResume; baseline: FittedResume }>();
  let names: string[] = [];
  try {
    names = readdirSync(directory).filter((name) => name.endsWith(".fitted.json"));
  } catch {
    return fitted;
  }
  for (const name of names) {
    const caseId = name.slice(0, -".fitted.json".length);
    try {
      fitted.set(caseId, JSON.parse(readFileSync(path.join(directory, name), "utf8")) as { role: FittedResume; baseline: FittedResume });
    } catch {
      fitted.set(caseId, { role: emptyFit(), baseline: emptyFit() });
    }
  }
  return fitted;
}

function supportedFacts(candidateId: string): string[] {
  const file = groundTruth(candidateId) as { facts?: { status?: string; text?: string }[] };
  return (file.facts ?? [])
    .filter((fact) => fact.status === "supported" && typeof fact.text === "string")
    .map((fact) => fact.text ?? "");
}

function renderReport(input: {
  testCase: BenchmarkCase;
  roleRefine: string;
  baseline: string;
  reverts: number;
  issues: string[];
  calls: CallCost[];
}): string {
  const lines = [
    `# ${input.testCase.id}`,
    "",
    "Paid generation. The resumes below are the page-fitted text when measurement succeeded. Phrase checks are not a score.",
    "",
    input.testCase.whyItMatters,
    "",
    "## Deterministic checks",
    "",
    `Guard reverts: ${input.reverts}. Issues: ${input.issues.join(", ") || "none"}.`,
    "",
  ];
  lines.push("These checks are not a winner. Equivalent wording counts. A missing number or credential does not.");
  lines.push("");
  for (const phrase of input.testCase.includeEvidence) {
    lines.push(`- Include "${phrase}": RoleRefine ${phraseMatch(input.roleRefine, phrase)}, baseline ${phraseMatch(input.baseline, phrase)}.`);
  }
  for (const phrase of input.testCase.avoidClaims) {
    lines.push(`- Avoid "${phrase}": RoleRefine ${phraseMatch(input.roleRefine, phrase)}, baseline ${phraseMatch(input.baseline, phrase)}.`);
  }
  lines.push("", "## Cost", "");
  for (const call of input.calls) {
    lines.push(`- ${call.label}: $${call.usd.toFixed(4)} (${call.inputTokens} in, ${call.outputTokens} out)`);
  }
  lines.push("", "## RoleRefine", "", input.roleRefine, "", "## Baseline", "", input.baseline, "");
  return lines.join("\n");
}

function pipelineNotes(trace: PipelineTrace): string {
  const lines = ["## Pipeline", "", trace.import, trace.pageFit, ""];
  const plan = trace.plan as {
    positioning?: string;
    gaps?: string[];
    evidence?: { ref: string; use: string; bullets: number; because: string }[];
  } | null;
  if (plan?.positioning) lines.push(`Positioning: ${plan.positioning}`, "");
  if (plan?.gaps?.length) lines.push(`Gaps: ${plan.gaps.join("; ")}`, "");
  for (const row of plan?.evidence ?? []) {
    lines.push(`- Plan ${row.use} ${row.ref} (${row.bullets}): ${row.because}`);
  }
  const unresolved = trace.dispositions.filter((row) => row.disposition === "unresolved").map((row) => row.ref);
  if (unresolved.length > 0) lines.push("", `Unresolved, not omitted: ${unresolved.join(", ")}.`);
  if (trace.fitted) {
    lines.push(
      "",
      `RoleRefine pages: ${trace.fitted.roleRefine.pageLimit ?? "not measured"}. Dropped lines: ${trace.fitted.roleRefine.dropped.length}.`,
      `Baseline pages: ${trace.fitted.baseline.pageLimit ?? "not measured"}. Dropped lines: ${trace.fitted.baseline.dropped.length}.`,
    );
  }
  if (trace.omissions.length > 0) {
    lines.push("", "Explicit omissions:");
    for (const row of trace.omissions) lines.push(`- ${row.ref}: ${row.because}`);
  }
  if (trace.guard) {
    lines.push("", `Guard reverts ${trace.guard.reverts}. Issues: ${trace.guard.issues.map((issue) => `${issue.code} ${issue.ref}`).join(", ") || "none"}.`);
  }
  lines.push(
    `Repair called: ${trace.repair.called}. Editorial applied: ${trace.editorial.applied}. Revision accepted: ${trace.revision.accepted.join(", ") || "none"}.`,
    "",
    "Compose review:",
  );
  for (const item of trace.composeReview) {
    lines.push(`- ${item.code} ${item.ref}: ${item.reason}`);
  }
  return lines.join("\n");
}

function emptyFit(): FittedResume {
  return {
    text: "",
    pageLimit: null,
    dropped: [],
    measured: false,
    note: "Not measured.",
  };
}
