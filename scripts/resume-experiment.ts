/**
 * Experimental comparison only. This does not change the production tailor.
 *
 * A: the current pipeline.
 * B: the same model, library, and job, with a resume-writing instruction and no
 *    RoleRefine schema, guard, or compose step.
 * C: the model writes the resume, then the existing guard checks it and a
 *    separate pass repairs only the unsupported claim.
 *
 * Run with LIVE_EXPERIMENT=1 via tests/unit/resume-experiment.test.ts.
 * The blind packet and the answer key are written under the temp directory.
 */

import "dotenv/config";

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { normalizeAnalyzeOutput, postProcessAnalyze } from "@/features/jobs/analyze";
import { JobAnalysis } from "@/features/jobs/schemas";
import { LibrarySnapshot } from "@/features/library/schemas";
import { libraryPromptText } from "@/features/library/serialize";
import { assembleResumeContent } from "@/features/tailor/assemble";
import { composeResume, type Composition } from "@/features/tailor/compose";
import { enforcePageBudget } from "@/features/tailor/page-fit";
import { resumePlainText } from "@/features/tailor/plainText";
import {
  applyAcceptedRepairs,
  countRevertedBullets,
  mergeRepair,
  repairTargets,
} from "@/features/tailor/repair";
import type { EntryKind } from "@/features/tailor/resume-shape";
import {
  acceptEditorial,
  acceptRevision,
  editorialLibrary,
  mergeRevision,
  notesForAccepted,
  notesForEditorial,
  revisionRoute,
} from "@/features/tailor/revise";
import { pageCeiling, TailorOptions, type ResumeLengthChoice, type TailorOutput, type ValidatedBullet, type ValidatedTailorOutput } from "@/features/tailor/schemas";
import { sameRoleText } from "@/features/tailor/stints";
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
  buildEditorialContent,
  buildReviseContent,
  EDITORIAL_SYSTEM,
  EditorialSchema,
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
import type { ResumePdfModel } from "@/lib/pdf/model";
import { ANALYST_POSTING, HOOTSUITE_POSTING } from "../tests/unit/hootsuite-posting";

const PREVIOUS_RESUME_ID = "e60b1950-2235-42af-8904-375ac828b5e9";
const REPEATS = 2;

const PROGRAM_POSTING = `Program Coordinator
Community Health Network
Ottawa, Ontario

About the role
Community Health Network runs neighbourhood programs for families. The Program Coordinator keeps those programs organized and explains how they are going to the people who fund and attend them. This is not a software, data, or technical role.

What you will do
- Coordinate schedules across program staff, partner organizations, and volunteers.
- Prepare a short monthly update for the board: what happened, what changed, and what needs a decision.
- Turn program records into plain-language summaries for families and community partners.
- Follow up when information is missing so the monthly update is complete before it is sent.
- Answer questions from staff and partners about dates, attendance, and next steps.
- Keep shared trackers accurate and notice when the same information has been entered twice.
- Write clear emails and one-page briefs. No specialized software is required.

What you bring
- Experience preparing recurring reports or updates for people who were not in the room.
- Comfort explaining numbers and status in everyday language.
- A record of keeping a repeating process reliable: checking the work, chasing gaps, and sending it on time.
- Experience working with more than one team or organization.
- Clear writing.

You do not need a technical degree, a programming language, or experience building software.`;

const DirectSchema = z.object({
  summary: z.string(),
  entries: z.array(
    z.object({
      heading: z.string(),
      title: z.string(),
      meta: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  skills: z.array(z.string()),
});

const ComposedSchema = z.object({
  summary: z.string(),
  entries: z.array(
    z.object({
      ref: z.string(),
      bullets: z.array(
        z.object({
          sourceRefs: z.array(z.string()),
          text: z.string(),
        }),
      ),
    }),
  ),
  skillGroups: z.array(
    z.object({
      category: z.string().nullable(),
      refs: z.array(z.string()),
    }),
  ),
});

const ClaimRepairSchema = z.object({
  summary: z.string(),
  bullets: z.array(
    z.object({
      sourceRefs: z.array(z.string()),
      text: z.string(),
    }),
  ),
});

const CLAIM_REPAIR_SYSTEM = `You repair a resume that is already written. Keep its selection, emphasis, and wording. Change only a claim the source does not support.

For a bullet: delete or rephrase the unsupported part. Keep every claim the sources do support, including the tools, actions, and context that are present. Do not replace the bullet with the original library sentence unless nothing in the bullet is supported.

For the summary: return one coherent paragraph. Remove a sentence the library does not support. Do not leave a fragment that starts with Also, And, or Additionally.

Do not add employers, tools, dates, metrics, or outcomes.`;

const DIRECT_SYSTEM = `You write a one-page resume for one job from a verified experience library.

Choose what to include, what to leave out, how much space each experience gets, and how to say it. Write the strongest truthful resume a recruiter for this job would want to read. Use only facts in the library. Do not add employers, titles, dates, tools, metrics, or outcomes that are not there.

Return the summary, the entries you chose, and a short skills list.`;

const COMPOSE_SYSTEM = `You write a one-page resume for one job from a verified experience library.

You own the selection, the order, the emphasis, and the wording. Choose the experiences that make the strongest truthful case for this job, and leave out the rest. Use only facts in the cited sources. You may combine facts from entries the library marks as the same role. Do not add employers, titles, dates, tools, metrics, or outcomes.

Every bullet cites the source refs it uses. Return the summary, the entries, and skill groups that cite skill refs. Do not return a strategy or a requirement-by-requirement report.`;

type Snapshot = LibrarySnapshot;
type Arm = "A" | "B" | "C";

function textBlock(value: string): Anthropic.ContentBlockParam[] {
  return [{ type: "text", text: value }];
}

type CallRow = {
  label: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicros: number | null;
  durationMs: number | null;
};

type Cell = {
  job: string;
  arm: Arm;
  repeat: number;
  text: string;
  pages: number;
  calls: CallRow[];
  reverts: number;
  issues: string[];
  repairs: { before: string; after: string; kept: boolean }[];
};

export async function runExperiment(): Promise<void> {
  const previous = await db.tailoredResume.findFirst({
    where: { id: PREVIOUS_RESUME_ID },
    select: { userId: true, librarySnapshot: true, options: true },
  });
  if (!previous?.librarySnapshot) throw new Error("Saved resume was not found.");
  const snapshot = LibrarySnapshot.parse(previous.librarySnapshot);
  const length = TailorOptions.parse(previous.options).length;
  const libraryText = libraryPromptText(snapshot);
  const only = new Set(
    (process.env.EXPERIMENT_JOBS ?? "")
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code.length > 0),
  );
  const jobs = (await loadJobs()).filter((job) => only.size === 0 || only.has(job.code));
  const cells: Cell[] = [];

  for (const job of jobs) {
    const analyzed = await analyze(previous.userId, job.posting);
    for (let repeat = 1; repeat <= REPEATS; repeat += 1) {
      for (const arm of ["A", "B", "C"] as const) {
        console.log(`start ${job.code} ${arm} ${repeat} posting=${job.posting.length}`);
        const cell = await runCell({
          arm,
          repeat,
          job: job.name,
          userId: previous.userId,
          snapshot,
          libraryText,
          posting: job.posting,
          title: analyzed?.title || job.title,
          company: analyzed?.company || job.company,
          analysis: analyzed?.analysis ?? null,
          length,
        });
        cells.push(cell);
        console.log(
          `done ${job.code} ${arm} ${repeat} pages=${cell.pages} calls=${cell.calls.length}`,
        );
      }
    }
  }

  const blind = blindPacket(cells);
  const suffix = only.size === 0 ? "" : `-${[...only].join("")}`;
  const blindPath = join(tmpdir(), `rolerefine-experiment-blind${suffix}.txt`);
  const keyPath = join(tmpdir(), `rolerefine-experiment-key${suffix}.json`);
  writeFileSync(blindPath, blind.text, "utf8");
  writeFileSync(
    keyPath,
    JSON.stringify({ key: blind.key, cells }, null, 2),
    "utf8",
  );
  console.log(`wrote ${blindPath}`);
  console.log(`wrote ${keyPath}`);
  await db.$disconnect();
}

async function loadJobs(): Promise<
  { code: string; name: string; title: string; company: string; posting: string }[]
> {
  const saved = await db.job.findMany({
    select: { company: true, title: true, rawText: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const hoot = saved.find((job) => job.company === "Hootsuite");
  const intuit = saved.find((job) => job.company === "Intuit");
  return [
    {
      code: "H",
      name: "Hootsuite",
      title: "Junior Software Developer",
      company: "Hootsuite",
      posting: postingBody(hoot?.rawText ?? "", HOOTSUITE_POSTING),
    },
    {
      code: "I",
      name: "Intuit",
      title: intuit?.title || "Software Developer 1",
      company: "Intuit",
      posting: postingBody(intuit?.rawText ?? "", ""),
    },
    {
      code: "R",
      name: "Reporting analyst",
      title: "Reporting Analyst",
      company: "Northline Mutual",
      posting: ANALYST_POSTING,
    },
    {
      code: "P",
      name: "Program coordinator",
      title: "Program Coordinator",
      company: "Community Health Network",
      posting: PROGRAM_POSTING,
    },
  ];
}

function postingBody(raw: string, fallback: string): string {
  const about = raw.split("About the job\n").at(-1)?.trim();
  return about && about.length > 200 ? about : fallback || raw;
}

async function analyze(
  userId: string,
  posting: string,
): Promise<{ title: string; company: string; analysis: JobAnalysis } | null> {
  const result = await runStructured({
    kind: "ANALYZE",
    userId,
    countsTowardQuota: false,
    system: ANALYZE_SYSTEM,
    content: buildAnalyzeContent(posting),
    schema: AnalyzeSchema,
    normalize: normalizeAnalyzeOutput,
    refId: randomUUID(),
  });
  if (!result.ok) return null;
  const checked = JobAnalysis.safeParse(postProcessAnalyze(result.data, posting));
  if (!checked.success) return null;
  return {
    title: checked.data.title,
    company: checked.data.company,
    analysis: checked.data,
  };
}

async function runCell(input: {
  arm: Arm;
  repeat: number;
  job: string;
  userId: string;
  snapshot: Snapshot;
  libraryText: string;
  posting: string;
  title: string;
  company: string;
  analysis: JobAnalysis | null;
  length: ResumeLengthChoice;
}): Promise<Cell> {
  try {
    if (input.arm === "A") return await runCurrent(input);
    if (input.arm === "B") return await runDirect(input);
    return await runEditorial(input);
  } catch (error) {
    return {
      job: input.job,
      arm: input.arm,
      repeat: input.repeat,
      text: error instanceof Error ? error.message : "The run failed.",
      pages: 0,
      calls: [],
      reverts: 0,
      issues: ["RUN_FAILED"],
      repairs: [],
    };
  }
}

async function runCurrent(input: {
  repeat: number;
  job: string;
  userId: string;
  snapshot: Snapshot;
  libraryText: string;
  posting: string;
  title: string;
  company: string;
  analysis: JobAnalysis | null;
  length: ResumeLengthChoice;
}): Promise<Cell> {
  const calls: CallRow[] = [];
  if (!input.analysis) return empty(input, "A", "Analysis failed.");
  const analysis = input.analysis;
  const generated = await tracked("generate", calls, (refId) =>
    runStructured({
      kind: "TAILOR",
      userId: input.userId,
      countsTowardQuota: false,
      system: TAILOR_SYSTEM,
      content: buildTailorContent({
        libraryText: input.libraryText,
        title: analysis.title || input.title,
        company: analysis.company || input.company,
        seniority: analysis.seniority,
        requirements: analysis.requirements,
        keywords: analysis.keywords,
        posting: input.posting,
        length: input.length,
        emphasis: null,
        sameRole: sameRoleText(input.snapshot.entries, input.snapshot.takenAt),
      }),
      schema: TailorSchema,
      refId,
    }),
  );
  if (!generated.ok) return empty(input, "A", "Tailor failed.", calls);
  const prepared = preferSavedWording(generated.data, [], input.snapshot);
  let guard = validateTailorOutput(prepared.output, input.snapshot, analysis);
  let notes = prepared.why;
  const repairs = repairTargets(prepared.output, guard, input.snapshot);
  if (repairs.length > 0) {
    const repair = await tracked("repair", calls, (refId) =>
      runStructured({
        kind: "TAILOR",
        userId: input.userId,
        countsTowardQuota: false,
        system: REPAIR_SYSTEM,
        content: buildRepairContent({
          title: analysis.title || input.title,
          company: analysis.company || input.company,
          requirements: analysis.requirements,
          targets: repairs,
        }),
        schema: RepairSchema,
        refId,
      }),
    );
    const parsed = repair.ok ? RepairSchema.safeParse(repair.data) : null;
    if (parsed?.success) {
      const merged = mergeRepair(prepared.output, parsed.data.bullets, repairs);
      const second = validateTailorOutput(merged, input.snapshot, analysis);
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
  const route = revisionRoute({ output: guard.output, snapshot: input.snapshot, analysis });
  let editorialApplied = false;
  if (route.kind === "editorial" && guard.output.plan) {
    const revised = await tracked("editorial", calls, (refId) =>
      runStructured({
        kind: "TAILOR",
        userId: input.userId,
        countsTowardQuota: false,
        system: EDITORIAL_SYSTEM,
        content: buildEditorialContent({
          title: analysis.title || input.title,
          company: analysis.company || input.company,
          length: input.length,
          strategy: guard.output.plan!,
          doubts: route.doubts,
          draft: guard.output.entries.map((entry) => ({
            ref: entry.ref,
            bullets: entry.bullets.map((bullet) => ({
              sourceRefs: bullet.sourceRefs,
              text: bullet.text,
            })),
          })),
          library: editorialLibrary({
            output: guard.output,
            snapshot: input.snapshot,
            targets: route.targets,
          }),
          sameRole: sameRoleText(input.snapshot.entries, input.snapshot.takenAt),
        }),
        schema: EditorialSchema,
        refId,
      }),
    );
    const parsed = revised.ok ? EditorialSchema.safeParse(revised.data) : null;
    if (parsed?.success && parsed.data.changed) {
      const second = validateTailorOutput(
        {
          ...guard.output,
          summary: parsed.data.summary,
          entries: parsed.data.entries.map((entry) => ({
            ref: entry.ref,
            bullets: entry.bullets.map((bullet) => ({
              sourceRefs: bullet.sourceRefs,
              text: bullet.text,
            })),
          })),
          requirementMatches: guard.output.requirementMatches.map((match) => ({
            requirementId: match.requirementId,
            verdict: match.verdict === "unassessed" ? "missing" : match.verdict,
            evidenceRefs: [...match.evidenceRefs],
            note: match.note,
          })),
        },
        input.snapshot,
        analysis,
      );
      const chosen = acceptEditorial(guard.output, second.output);
      if (chosen.accepted && second.reverts <= guard.reverts) {
        editorialApplied = true;
        guard = { output: chosen.output, reverts: second.reverts, issues: second.issues };
        notes = notesForEditorial(notes, parsed.data.entries);
      }
    }
  }
  if (!editorialApplied && route.kind !== "none" && route.targets.length > 0) {
    const revised = await tracked("revision", calls, (refId) =>
      runStructured({
        kind: "TAILOR",
        userId: input.userId,
        countsTowardQuota: false,
        system: REVISE_SYSTEM,
        content: buildReviseContent({
          title: analysis.title || input.title,
          company: analysis.company || input.company,
          targets: route.targets,
        }),
        schema: ReviseSchema,
        refId,
      }),
    );
    if (revised.ok) {
      const merged = mergeRevision(guard.output, revised.data.entries, route.targets);
      const second = validateTailorOutput(merged.output, input.snapshot, analysis);
      const chosen = acceptRevision(
        guard.output,
        second.output,
        route.targets.map((target) => target.entryRef),
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
    analysis,
    length: input.length,
  });
  const assembled = assembleResumeContent(
    composition.output,
    input.snapshot,
    () => randomUUID(),
    notes,
    composition,
  );
  const beforeText = resumePlainText(assembled, input.snapshot);
  const beforePages = await pageCount(assembled, input.snapshot);
  const fitted = await enforcePageBudget(assembled, input.snapshot, pageCeiling(input.length));
  const afterText = resumePlainText(fitted, input.snapshot);
  return {
    job: input.job,
    arm: "A",
    repeat: input.repeat,
    text: afterText,
    pages: await pageCount(fitted, input.snapshot),
    calls,
    reverts: guard.reverts,
    issues: [
      ...guard.issues.map((issue) => `${issue.code} ${issue.ref}`),
      beforeText === afterText ? "" : `page_fit_removed_lines before_pages=${beforePages}`,
    ].filter((issue) => issue.length > 0),
    repairs: [],
  };
}

async function runDirect(input: {
  repeat: number;
  job: string;
  userId: string;
  snapshot: Snapshot;
  libraryText: string;
  posting: string;
  title: string;
  company: string;
  length: ResumeLengthChoice;
}): Promise<Cell> {
  const calls: CallRow[] = [];
  const generated = await tracked("direct", calls, (refId) =>
    runStructured({
      kind: "TAILOR",
      userId: input.userId,
      countsTowardQuota: false,
      system: DIRECT_SYSTEM,
      content: textBlock(
        [
          `# Library`,
          input.libraryText,
          "",
          `# Job`,
          `${input.title} at ${input.company}`,
          "",
          input.posting,
          "",
          input.length === "auto" ? "Target length: automatic." : `Target length: ${input.length} page.`,
        ].join("\n"),
      ),
      schema: DirectSchema,
      refId,
    }),
  );
  if (!generated.ok) return empty(input, "B", "Direct call failed.", calls);
  const data = DirectSchema.parse(generated.data);
  const model = directModel(data, input.snapshot);
  return {
    job: input.job,
    arm: "B",
    repeat: input.repeat,
    text: directText(model),
    pages: await pageCountOf(model),
    calls,
    reverts: 0,
    issues: [],
    repairs: [],
  };
}

async function runEditorial(input: {
  repeat: number;
  job: string;
  userId: string;
  snapshot: Snapshot;
  libraryText: string;
  posting: string;
  title: string;
  company: string;
  analysis: JobAnalysis | null;
  length: ResumeLengthChoice;
}): Promise<Cell> {
  const calls: CallRow[] = [];
  if (!input.analysis) return empty(input, "C", "Analysis failed.");
  const analysis = input.analysis;
  const generated = await tracked("compose", calls, (refId) =>
    runStructured({
      kind: "TAILOR",
      userId: input.userId,
      countsTowardQuota: false,
      system: COMPOSE_SYSTEM,
      content: textBlock(
        [
          `# Library`,
          input.libraryText,
          "",
          `# Same role`,
          sameRoleText(input.snapshot.entries, input.snapshot.takenAt),
          "",
          `# Job`,
          `${analysis.title || input.title} at ${analysis.company || input.company}`,
          "",
          input.posting,
          "",
          input.length === "auto" ? "Target length: automatic." : `Target length: ${input.length} page.`,
        ].join("\n"),
      ),
      schema: ComposedSchema,
      refId,
    }),
  );
  if (!generated.ok) return empty(input, "C", "Compose failed.", calls);
  const composed = ComposedSchema.parse(generated.data);
  const draft = toTailorOutput(composed, analysis);
  const editorialText = bulletLines(composed);
  let guard = validateTailorOutput(draft, input.snapshot, analysis);
  const repairs: Cell["repairs"] = [];
  const broken = revertedBullets(guard.output).map((item) => ({
    sourceRefs: item.sourceRefs,
    text: findDraftBullet(draft, item.sourceRefs)?.text ?? item.text,
  }));
  const summaryBroken = guard.issues.some((issue) => issue.code === "G12");
  if (broken.length > 0 || summaryBroken) {
    const repair = await tracked("claim-repair", calls, (refId) =>
      runStructured({
        kind: "TAILOR",
        userId: input.userId,
        countsTowardQuota: false,
        system: CLAIM_REPAIR_SYSTEM,
        content: textBlock(
          claimRepairContent(draft.summary, input.snapshot, broken, summaryBroken),
        ),
        schema: ClaimRepairSchema,
        refId,
      }),
    );
    if (repair.ok) {
      const patched = applyClaimRepair(draft, ClaimRepairSchema.parse(repair.data), broken);
      const second = validateTailorOutput(patched, input.snapshot, analysis);
      const kept = new Set<string>();
      for (const bullet of broken) {
        const after = findBullet(second.output, bullet.sourceRefs);
        const accepted = after !== null && !after.reverted;
        repairs.push({ before: bullet.text, after: after?.text ?? "", kept: accepted });
        if (accepted) kept.add(bullet.sourceRefs.join("|"));
      }
      const summaryAccepted = !second.issues.some((issue) => issue.code === "G12");
      const hybrid = {
        ...second.output,
        summary: summaryBroken && !summaryAccepted ? guard.output.summary : second.output.summary,
        entries: second.output.entries.map((entry) => ({
          ...entry,
          bullets: entry.bullets.map((bullet) => {
            const key = bullet.sourceRefs.join("|");
            if (!broken.some((item) => item.sourceRefs.join("|") === key)) return bullet;
            return kept.has(key) ? bullet : (findBullet(guard.output, bullet.sourceRefs) ?? bullet);
          }),
        })),
      };
      guard = validateTailorOutput(
        {
          ...hybrid,
          requirementMatches: hybrid.requirementMatches.map((match) => ({
            ...match,
            verdict: match.verdict === "unassessed" ? "missing" : match.verdict,
          })),
        },
        input.snapshot,
        analysis,
      );
    }
  }
  const composition: Composition = {
    output: guard.output,
    sectionOrder: sectionOrder(guard.output, input.snapshot),
    contacts: [],
    review: [],
    presentation: {},
    stints: [],
    headline: null,
    pageLimit: 1,
  };
  const content = assembleResumeContent(
    guard.output,
    input.snapshot,
    () => randomUUID(),
    new Map(),
    composition,
  );
  return {
    job: input.job,
    arm: "C",
    repeat: input.repeat,
    text: `${resumePlainText(content, input.snapshot)}\n\n--- Editorial draft ---\n${editorialText}`,
    pages: await pageCount(content, input.snapshot),
    calls,
    reverts: guard.reverts,
    issues: guard.issues.map((issue) => `${issue.code} ${issue.ref}`),
    repairs,
  };
}

function claimRepairContent(
  summary: string,
  snapshot: Snapshot,
  broken: { sourceRefs: string[]; text: string }[],
  summaryBroken: boolean,
): string {
  const lines = ["# Summary", summary, ""];
  if (!summaryBroken) lines.push("The summary is supported. Return it unchanged.", "");
  lines.push("# Bullets to repair");
  for (const bullet of broken) {
    lines.push(`Bullet: ${bullet.text}`);
    lines.push("Sources:");
    for (const ref of bullet.sourceRefs) {
      const source = sourceText(snapshot, ref);
      if (source) lines.push(`- ${ref}: ${source}`);
    }
    lines.push("");
  }
  if (broken.length === 0) lines.push("No bullets need repair.", "");
  lines.push("Return the summary and one repaired bullet for each bullet above.");
  return lines.join("\n");
}

function sourceText(snapshot: Snapshot, ref: string): string | null {
  for (const entry of snapshot.entries) {
    const bullet = entry.bullets.find((item) => item.ref === ref);
    if (bullet) return bullet.text;
  }
  return null;
}

function revertedBullets(
  output: ValidatedTailorOutput,
): { sourceRefs: string[]; text: string }[] {
  return output.entries.flatMap((entry) =>
    entry.bullets
      .filter((bullet) => bullet.reverted)
      .map((bullet) => ({ sourceRefs: [...bullet.sourceRefs], text: bullet.text })),
  );
}

function findDraftBullet(
  output: TailorOutput,
  sourceRefs: string[],
): { text: string } | null {
  const key = sourceRefs.join("|");
  for (const entry of output.entries) {
    for (const bullet of entry.bullets) {
      if (bullet.sourceRefs.join("|") === key) return bullet;
    }
  }
  return null;
}

function findBullet(
  output: ValidatedTailorOutput,
  sourceRefs: string[],
): ValidatedBullet | null {
  const key = sourceRefs.join("|");
  for (const entry of output.entries) {
    for (const bullet of entry.bullets) {
      if (bullet.sourceRefs.join("|") === key) return bullet;
    }
  }
  return null;
}

function applyClaimRepair(
  draft: TailorOutput,
  repair: z.infer<typeof ClaimRepairSchema>,
  broken: { sourceRefs: string[] }[],
): TailorOutput {
  return {
    ...draft,
    summary: repair.summary,
    entries: draft.entries.map((entry) => ({
      ...entry,
      bullets: entry.bullets.map((bullet) => {
        const match = repair.bullets.find(
          (item) => item.sourceRefs.join("|") === bullet.sourceRefs.join("|"),
        );
        const targeted = broken.some(
          (item) => item.sourceRefs.join("|") === bullet.sourceRefs.join("|"),
        );
        return targeted && match ? { ...bullet, text: match.text } : bullet;
      }),
    })),
  };
}

function toTailorOutput(
  composed: z.infer<typeof ComposedSchema>,
  analysis: JobAnalysis,
): TailorOutput {
  return {
    summary: composed.summary,
    entries: composed.entries,
    requirementMatches: analysis.requirements.map((requirement) => ({
      requirementId: requirement.id,
      verdict: "missing" as const,
      evidenceRefs: [],
      note: "",
    })),
    skills: composed.skillGroups,
  };
}

function sectionOrder(output: ValidatedTailorOutput, snapshot: Snapshot): EntryKind[] {
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry.kind]));
  const order: EntryKind[] = [];
  for (const entry of output.entries) {
    const kind = byRef.get(entry.ref);
    if (kind && !order.includes(kind)) order.push(kind);
  }
  return order;
}

function bulletLines(composed: z.infer<typeof ComposedSchema>): string {
  return [
    composed.summary,
    ...composed.entries.flatMap((entry) => [
      entry.ref,
      ...entry.bullets.map((bullet) => `- ${bullet.text}`),
    ]),
  ].join("\n");
}

function directModel(
  data: z.infer<typeof DirectSchema>,
  snapshot: Snapshot,
): ResumePdfModel {
  const profile = snapshot.profile;
  const contact = [profile.location, profile.email, profile.phone]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" · ");
  return {
    name: profile.fullName?.trim() || null,
    headline: profile.headline?.trim() || null,
    contact: contact.length > 0 ? contact : null,
    links: profile.links.map((link) => link.label || link.url),
    summary: data.summary.trim() || null,
    sections: [
      {
        heading: "Experience",
        entries: data.entries.map((entry) => ({
          title: entry.title.trim() || entry.heading.trim() || null,
          meta: entry.meta.trim() || null,
          bullets: entry.bullets.map((bullet) => bullet.trim()).filter((bullet) => bullet.length > 0),
          url: null,
        })),
      },
    ],
    skills: data.skills.map((skill) => skill.trim()).filter((skill) => skill.length > 0),
  };
}

function directText(model: ResumePdfModel): string {
  const lines: string[] = [];
  if (model.name) lines.push(model.name);
  if (model.headline) lines.push(model.headline);
  if (model.contact) lines.push(model.contact);
  lines.push(...model.links);
  if (model.summary) lines.push("Summary", model.summary);
  for (const section of model.sections) {
    lines.push(section.heading);
    for (const entry of section.entries) {
      if (entry.title) lines.push(entry.title);
      if (entry.meta) lines.push(entry.meta);
      for (const bullet of entry.bullets) lines.push(`- ${bullet}`);
    }
  }
  if (model.skills.length > 0) lines.push("Skills", model.skills.join(", "));
  return lines.join("\n");
}

async function pageCount(
  content: Awaited<ReturnType<typeof assembleResumeContent>>,
  snapshot: Snapshot,
): Promise<number> {
  const { resumePdfModel } = await import("@/lib/pdf/model");
  return pageCountOf(resumePdfModel(content, snapshot));
}

async function pageCountOf(model: ResumePdfModel): Promise<number> {
  const { fitResumePdf } = await import("@/lib/pdf/render");
  const fit = await fitResumePdf(model, "classic");
  return fit.pageCount;
}

function empty(
  input: { job: string; repeat: number },
  arm: Arm,
  text: string,
  calls: CallRow[] = [],
): Cell {
  return {
    job: input.job,
    arm,
    repeat: input.repeat,
    text,
    pages: 0,
    calls,
    reverts: 0,
    issues: [],
    repairs: [],
  };
}

async function tracked<T extends { ok: boolean }>(
  label: string,
  calls: CallRow[],
  call: (refId: string) => Promise<T>,
): Promise<T> {
  const refId = randomUUID();
  const result = await call(refId);
  const row = await db.aiCall.findFirst({
    where: { refId },
    orderBy: { createdAt: "desc" },
    select: { inputTokens: true, outputTokens: true, costMicros: true, durationMs: true },
  });
  calls.push({
    label,
    inputTokens: row?.inputTokens ?? null,
    outputTokens: row?.outputTokens ?? null,
    costMicros: row?.costMicros ?? null,
    durationMs: row?.durationMs ?? null,
  });
  return result;
}

function blindPacket(cells: Cell[]): {
  text: string;
  key: { label: string; job: string; arm: Arm; repeat: number }[];
} {
  const key: { label: string; job: string; arm: Arm; repeat: number }[] = [];
  const parts: string[] = [];
  const jobs = [...new Set(cells.map((cell) => cell.job))];
  for (const job of jobs) {
    const group = cells.filter((cell) => cell.job === job);
    const order = group.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      const current = order[index]!;
      order[index] = order[swap]!;
      order[swap] = current;
    }
    parts.push(`# ${job}`);
    order.forEach((cellIndex, position) => {
      const cell = group[cellIndex]!;
      const label = `${job.slice(0, 1).toUpperCase()}-${position + 1}`;
      key.push({ label, job, arm: cell.arm, repeat: cell.repeat });
      const visible = cell.text.split("\n\n--- Editorial draft ---")[0] ?? cell.text;
      parts.push(`## ${label}`, visible.trim(), "");
    });
  }
  return { text: parts.join("\n"), key };
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/resume-experiment.ts");
if (isDirectRun) void runExperiment();
