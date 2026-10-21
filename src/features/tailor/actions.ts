"use server";

import { revalidatePath } from "next/cache";

import { strings } from "@/copy/strings";
import { checkQuota } from "@/features/billing/quota";
import { getLibrary } from "@/features/library/queries";
import { zodFieldErrors } from "@/features/library/schemas";
import { serializeLibrary } from "@/features/library/serialize";
import type { Library } from "@/features/library/types";
import { JobAnalysis } from "@/features/jobs/schemas";
import { Prisma } from "@/generated/prisma/client";
import { buildContent, OutputSchema, SYSTEM } from "@/lib/ai/prompts/tailor";
import { runStructured } from "@/lib/ai/run";
import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { assembleResumeContent } from "./assemble";
import { TAILOR_STALE_MS } from "./status";
import { scoreMatch } from "./score";
import {
  TailorOptions,
  rateResumeSchema,
  tailorResumeSchema,
} from "./schemas";
import { validateTailorOutput } from "./validate";

const copy = strings.jobs.documents;

export type TailorResumeResult = {
  resumeId: string;
};

/** Tailor a resume for one job. docs/03-ARCHITECTURE.md → Data flow: tailor. */
export async function tailorResume(
  input: unknown,
): Promise<ActionResult<TailorResumeResult>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = tailorResumeSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const job = await db.job.findFirst({
    where: { id: parsed.data.jobId, userId: user.id },
    select: {
      id: true,
      title: true,
      company: true,
      rawText: true,
      analysisStatus: true,
      analysis: true,
    },
  });
  if (!job) return fail("NOT_FOUND");

  const analysis =
    job.analysisStatus === "READY" ? JobAnalysis.safeParse(job.analysis) : null;
  if (!analysis?.success) {
    return fail("VALIDATION", { job: [copy.disabledAnalysis] });
  }

  const library = await getLibrary(user.id);
  if (!library) return fail("NOT_FOUND");
  if (!libraryHasMaterial(library)) {
    return fail("VALIDATION", { library: [copy.disabledLibrary] });
  }

  const quota = await checkQuota(user, "TAILOR");
  if (!quota.allowed) return fail("QUOTA_EXCEEDED");

  const options = TailorOptions.parse({
    length: parsed.data.length,
    ...(parsed.data.emphasis ? { emphasis: parsed.data.emphasis } : {}),
  });
  const now = new Date();
  const serialized = serializeLibrary(library, now.toISOString());

  let resumeId: string;
  try {
    const claimed = await claimVersion({
      userId: user.id,
      jobId: job.id,
      now,
      options,
      snapshot: serialized.snapshot,
    });
    if (claimed === "conflict") return fail("CONFLICT");
    resumeId = claimed.id;
  } catch {
    return fail("INTERNAL");
  }

  try {
    const result = await runStructured({
      kind: "TAILOR",
      userId: user.id,
      usedBonusCredit: quota.useBonus,
      system: SYSTEM,
      content: buildContent({
        libraryText: serialized.text,
        title: job.title,
        company: job.company,
        seniority: analysis.data.seniority,
        requirements: analysis.data.requirements,
        keywords: analysis.data.keywords,
        posting: job.rawText,
        length: options.length,
        emphasis: options.emphasis ?? null,
      }),
      schema: OutputSchema,
      refId: resumeId,
    });
    if (!result.ok) {
      await markFailed(user.id, resumeId, result.code);
      revalidateJob(job.id);
      return fail("AI_FAILED");
    }

    const guard = validateTailorOutput(
      result.data,
      serialized.snapshot,
      analysis.data,
    );
    logGuard(user.id, resumeId, guard.reverts, guard.issues);
    const content = assembleResumeContent(guard.output, serialized.snapshot);
    const report = scoreMatch(analysis.data, guard.output.requirementMatches);
    const saved = await db.$transaction(async (tx) => {
      const updated = await tx.tailoredResume.updateMany({
        where: { id: resumeId, userId: user.id, status: "PENDING" },
        data: {
          status: "READY",
          aiOutput: toJson(guard.output),
          content: toJson(content),
          matchReport: toJson(report),
          matchScore: report.score,
          guardReverts: guard.reverts,
          error: null,
        },
      });
      if (updated.count === 0) return false;
      await tx.jobEvent.create({
        data: {
          userId: user.id,
          jobId: job.id,
          type: "RESUME_TAILORED",
        },
      });
      return true;
    });
    if (!saved) return fail("NOT_FOUND");
    revalidateJob(job.id);
    return ok({ resumeId });
  } catch {
    try {
      await markFailed(user.id, resumeId, "INTERNAL");
    } catch {
      return fail("INTERNAL");
    }
    revalidateJob(job.id);
    return fail("AI_FAILED");
  }
}

/** Set helpful or not helpful. The same choice again clears it. */
export async function rateTailoredResume(
  input: unknown,
): Promise<ActionResult<{ rating: 1 | -1 | null }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = rateResumeSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const existing = await db.tailoredResume.findFirst({
    where: { id: parsed.data.resumeId, userId: user.id, status: "READY" },
    select: { id: true, jobId: true, rating: true },
  });
  if (!existing) return fail("NOT_FOUND");

  const rating = existing.rating === parsed.data.rating ? null : parsed.data.rating;
  const updated = await db.tailoredResume.updateMany({
    where: { id: existing.id, userId: user.id },
    data: { rating, ratingReason: null },
  });
  if (updated.count === 0) return fail("NOT_FOUND");
  revalidateJob(existing.jobId);
  return ok({ rating });
}

function libraryHasMaterial(library: Library): boolean {
  return library.entries.length > 0 || library.skills.length > 0;
}

async function claimVersion(input: {
  userId: string;
  jobId: string;
  now: Date;
  options: TailorOptions;
  snapshot: ReturnType<typeof serializeLibrary>["snapshot"];
}): Promise<{ id: string } | "conflict"> {
  try {
    const claimed = await db.$transaction(async (tx) => {
      const pending = await tx.tailoredResume.findFirst({
        where: {
          userId: input.userId,
          jobId: input.jobId,
          status: "PENDING",
          updatedAt: { gt: new Date(input.now.getTime() - TAILOR_STALE_MS) },
        },
        select: { id: true },
      });
      if (pending) return null;

      const latest = await tx.tailoredResume.findFirst({
        where: { userId: input.userId, jobId: input.jobId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      return tx.tailoredResume.create({
        data: {
          userId: input.userId,
          jobId: input.jobId,
          version: (latest?.version ?? 0) + 1,
          status: "PENDING",
          options: toJson(input.options),
          librarySnapshot: toJson(input.snapshot),
          templateId: "classic",
        },
        select: { id: true },
      });
    });
    return claimed ?? "conflict";
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "conflict";
    }
    throw error;
  }
}

async function markFailed(
  userId: string,
  resumeId: string,
  error: string,
): Promise<void> {
  await db.tailoredResume.updateMany({
    where: { id: resumeId, userId, status: "PENDING" },
    data: { status: "FAILED", error },
  });
}

function logGuard(
  userId: string,
  resumeId: string,
  reverts: number,
  issues: { code: string; ref: string }[],
): void {
  if (issues.length === 0) return;
  console.info(
    JSON.stringify({
      event: "tailor.guard",
      userId,
      resumeId,
      reverts,
      issues: issues.map((issue) => ({ code: issue.code, ref: issue.ref })),
    }),
  );
}

function revalidateJob(jobId: string): void {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
