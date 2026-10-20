"use server";

import { revalidatePath } from "next/cache";

import { strings } from "@/copy/strings";
import { checkQuota, type QuotaDecision } from "@/features/billing/quota";
import { zodFieldErrors } from "@/features/library/schemas";
import { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth";
import { requireUserForAction } from "@/lib/auth";
import { buildContent, OutputSchema, SYSTEM } from "@/lib/ai/prompts/analyze";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import {
  ANALYSIS_STALE_MS,
  canRetryAnalysis,
  postProcessAnalyze,
  prefillFromAnalysis,
  type JobDetailColumns,
} from "./analyze";
import { deadlineInstant, deadlineReminderDue } from "./dates";
import type { CreateJobData, JobAnalysis } from "./schemas";
import { createJobSchema, retryAnalysisSchema } from "./schemas";

const placeholders = strings.jobs.placeholders;

export type JobWriteResult = {
  jobId: string;
  analysisStatus: "READY" | "FAILED";
};

/** Save a posting, analyse it, and open the job either way. */
export async function createJob(
  input: unknown,
): Promise<ActionResult<JobWriteResult>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = createJobSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const quota = await checkQuota(user, "ANALYZE");
  if (!quota.allowed) return fail("QUOTA_EXCEEDED");

  const data = parsed.data;
  const deadline = data.deadline ? deadlineInstant(data.deadline) : null;
  const jobId = await insertJob(user.id, {
    rawText: data.rawText,
    url: data.url,
    source: data.source,
    priority: data.priority,
    deadline,
  });

  return analyzeAndSave(user, jobId, data.rawText, blankColumns(), quota);
}

/** Run analysis again on a FAILED job, or one stuck PENDING for 5 minutes. */
export async function retryAnalysis(
  input: unknown,
): Promise<ActionResult<JobWriteResult>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = retryAnalysisSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const now = new Date();
  const existing = await db.job.findFirst({
    where: { id: parsed.data.jobId, userId: user.id },
    select: jobColumns,
  });
  if (!existing) return fail("NOT_FOUND");
  if (!canRetryAnalysis(existing.analysisStatus, existing.updatedAt, now)) {
    return fail("CONFLICT");
  }

  const quota = await checkQuota(user, "ANALYZE");
  if (!quota.allowed) return fail("QUOTA_EXCEEDED");

  const claimed = await db.job.updateMany({
    where: {
      id: existing.id,
      userId: user.id,
      OR: [
        { analysisStatus: "FAILED" },
        {
          analysisStatus: "PENDING",
          updatedAt: { lte: new Date(now.getTime() - ANALYSIS_STALE_MS) },
        },
      ],
    },
    data: { analysisStatus: "PENDING" },
  });
  if (claimed.count === 0) {
    const still = await db.job.findFirst({
      where: { id: existing.id, userId: user.id },
      select: { id: true },
    });
    return still ? fail("CONFLICT") : fail("NOT_FOUND");
  }

  return analyzeAndSave(
    user,
    existing.id,
    existing.rawText,
    columnsFrom(existing),
    quota,
  );
}

const jobColumns = {
  id: true,
  title: true,
  company: true,
  location: true,
  rawText: true,
  workMode: true,
  employmentType: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryPeriod: true,
  referenceNumber: true,
  analysisStatus: true,
  updatedAt: true,
} as const;

function blankColumns(): JobDetailColumns {
  return {
    title: placeholders.title,
    company: placeholders.company,
    location: null,
    workMode: "UNKNOWN",
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    referenceNumber: null,
  };
}

function columnsFrom(row: {
  title: string;
  company: string;
  location: string | null;
  workMode: JobDetailColumns["workMode"];
  employmentType: JobDetailColumns["employmentType"];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: JobDetailColumns["salaryPeriod"];
  referenceNumber: string | null;
}): JobDetailColumns {
  return {
    title: row.title,
    company: row.company,
    location: row.location,
    workMode: row.workMode,
    employmentType: row.employmentType,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod,
    referenceNumber: row.referenceNumber,
  };
}

async function insertJob(
  userId: string,
  input: {
    rawText: string;
    url: CreateJobData["url"];
    source: CreateJobData["source"];
    priority: CreateJobData["priority"];
    deadline: Date | null;
  },
): Promise<string> {
  const created = await db.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        userId,
        title: placeholders.title,
        company: placeholders.company,
        url: input.url,
        rawText: input.rawText,
        source: input.source,
        priority: input.priority,
        deadline: input.deadline,
        boardOrder: Date.now(),
        analysisStatus: "PENDING",
      },
      select: { id: true },
    });
    await tx.jobEvent.create({
      data: {
        userId,
        jobId: job.id,
        type: "CREATED",
      },
    });
    if (input.deadline) {
      await tx.reminder.create({
        data: {
          userId,
          jobId: job.id,
          kind: "DEADLINE",
          title: strings.jobs.reminder.deadline,
          dueAt: deadlineReminderDue(input.deadline),
          autoCreated: true,
        },
      });
    }
    return job;
  });
  return created.id;
}

async function analyzeAndSave(
  user: Pick<SessionUser, "id" | "plan">,
  jobId: string,
  rawText: string,
  current: JobDetailColumns,
  quota: QuotaDecision,
): Promise<ActionResult<JobWriteResult>> {
  const result = await runStructured({
    kind: "ANALYZE",
    userId: user.id,
    usedBonusCredit: quota.useBonus,
    system: SYSTEM,
    content: buildContent(rawText),
    schema: OutputSchema,
    refId: jobId,
  });
  if (!result.ok) {
    await markAnalysisFailed(user.id, jobId);
    revalidateJob(jobId);
    return ok({ jobId, analysisStatus: "FAILED" });
  }

  let analysis: JobAnalysis;
  try {
    analysis = postProcessAnalyze(result.data);
  } catch {
    await markAnalysisFailed(user.id, jobId);
    revalidateJob(jobId);
    return ok({ jobId, analysisStatus: "FAILED" });
  }

  try {
    const saved = await saveAnalysis(user.id, jobId, current, analysis);
    if (!saved) return fail("NOT_FOUND");
  } catch {
    await markAnalysisFailed(user.id, jobId).catch(() => undefined);
    revalidateJob(jobId);
    return ok({ jobId, analysisStatus: "FAILED" });
  }

  revalidateJob(jobId);
  return ok({ jobId, analysisStatus: "READY" });
}

async function saveAnalysis(
  userId: string,
  jobId: string,
  current: JobDetailColumns,
  analysis: JobAnalysis,
): Promise<boolean> {
  const written = await db.job.updateMany({
    where: { id: jobId, userId },
    data: {
      analysisStatus: "READY",
      analysis: toJson(analysis),
      ...prefillFromAnalysis(current, analysis),
    },
  });
  return written.count > 0;
}

async function markAnalysisFailed(userId: string, jobId: string): Promise<void> {
  await db.job.updateMany({
    where: { id: jobId, userId },
    data: { analysisStatus: "FAILED" },
  });
}

function toJson(analysis: JobAnalysis): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(analysis)) as Prisma.InputJsonValue;
}

function revalidateJob(jobId: string): void {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}
