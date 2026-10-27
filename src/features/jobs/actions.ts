"use server";

import { revalidatePath } from "next/cache";

import { strings } from "@/copy/strings";
import {
  checkQuota,
  releaseUnsavedAnalysis,
  type QuotaDecision,
} from "@/features/billing/quota";
import { zodFieldErrors } from "@/features/library/schemas";
import { deadlineReminderTitle } from "@/features/tracking/reminders";
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
import {
  deadlineInstant,
  deadlineReminderDue,
  planDeadlineReminder,
} from "./dates";
import { boardInsertIndex, planColumnMove } from "./board-order";
import { applyStatusChange } from "./pipeline";
import type { CreateJobData, JobAnalysis } from "./schemas";
import {
  archiveJobsSchema,
  createJobSchema,
  deleteJobSchema,
  isClosedJobStatus,
  moveJobSchema,
  retryAnalysisSchema,
  setJobArchivedSchema,
  setJobPrioritySchema,
  updateJobDetailsSchema,
  updateJobIdentitySchema,
  updateJobStatusSchema,
} from "./schemas";

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

  await releaseUnsavedAnalysis(user.id, existing.id);

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
          title: deadlineReminderTitle(placeholders.company),
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
    await releaseUnsavedAnalysis(user.id, jobId);
    await markAnalysisFailed(user.id, jobId);
    revalidateJob(jobId);
    return ok({ jobId, analysisStatus: "FAILED" });
  }

  try {
    const saved = await saveAnalysis(user.id, jobId, current, analysis);
    if (!saved) {
      await releaseUnsavedAnalysis(user.id, jobId);
      return fail("NOT_FOUND");
    }
  } catch {
    await releaseUnsavedAnalysis(user.id, jobId);
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
  const patch = prefillFromAnalysis(current, analysis);
  const written = await db.job.updateMany({
    where: { id: jobId, userId },
    data: {
      analysisStatus: "READY",
      analysis: toJson(analysis),
      ...patch,
    },
  });
  if (written.count > 0 && patch.company) {
    await renameOpenDeadlineReminder(userId, jobId, patch.company);
  }
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
  revalidatePath("/jobs/new");
}

/** Move the job through the pipeline. A closed status can store a reason. */
export async function updateJobStatus(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateJobStatusSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const data = parsed.data;
  const result = await applyStatusChange(user.id, data.jobId, data.status, {
    closeReason: isClosedJobStatus(data.status) ? data.closeReason : undefined,
  });
  if (!result) return fail("NOT_FOUND");

  revalidateJob(data.jobId);
  return ok({ id: data.jobId });
}

/** Move a card on the board. A status change goes through the pipeline. */
export async function moveJob(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = moveJobSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const data = parsed.data;
  const job = await db.job.findFirst({
    where: { id: data.jobId, userId: user.id },
    select: { id: true, status: true },
  });
  if (!job) return fail("NOT_FOUND");

  const destination = await db.job.findMany({
    where: { userId: user.id, status: data.toStatus },
    select: { id: true, boardOrder: true },
    orderBy: [{ boardOrder: "asc" }, { id: "asc" }],
  });
  const others = destination.filter((card) => card.id !== job.id);
  const index = boardInsertIndex(
    others.map((card) => card.id),
    data.beforeId ?? null,
    data.afterId ?? null,
  );

  if (job.status === data.toStatus) {
    const current = destination.findIndex((card) => card.id === job.id);
    if (current === index) return ok({ id: job.id });
  } else {
    const changed = await applyStatusChange(user.id, job.id, data.toStatus, {
      closeReason: isClosedJobStatus(data.toStatus) ? data.closeReason : undefined,
    });
    if (!changed) return fail("NOT_FOUND");
  }

  const planned = planColumnMove({ movingId: job.id, others, index });
  await db.$transaction(
    planned.map((row) =>
      db.job.updateMany({
        where: { id: row.id, userId: user.id },
        data: { boardOrder: row.boardOrder },
      }),
    ),
  );

  revalidateJob(job.id);
  return ok({ id: job.id });
}

/** Set priority stars, or clear them. */
export async function setJobPriority(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = setJobPrioritySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const written = await db.job.updateMany({
    where: { id: parsed.data.jobId, userId: user.id },
    data: { priority: parsed.data.priority },
  });
  if (written.count === 0) return fail("NOT_FOUND");

  revalidateJob(parsed.data.jobId);
  return ok({ id: parsed.data.jobId });
}

/** Hide the job from the board, or put it back. Status stays. */
export async function setJobArchived(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = setJobArchivedSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const written = await db.job.updateMany({
    where: { id: parsed.data.jobId, userId: user.id },
    data: { archivedAt: parsed.data.archived ? new Date() : null },
  });
  if (written.count === 0) return fail("NOT_FOUND");

  revalidateJob(parsed.data.jobId);
  return ok({ id: parsed.data.jobId });
}

/** Archive or restore several owned jobs. Status stays. Missing ids are skipped. */
export async function archiveJobs(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = archiveJobsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const written = await db.job.updateMany({
    where: { id: { in: parsed.data.jobIds }, userId: user.id },
    data: { archivedAt: parsed.data.archived ? new Date() : null },
  });
  if (written.count === 0) return fail("NOT_FOUND");

  for (const jobId of parsed.data.jobIds) {
    revalidatePath(`/jobs/${jobId}`);
  }
  revalidatePath("/jobs");
  return ok({ count: written.count });
}

/** Delete one owned job. Related rows cascade. */
export async function deleteJob(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = deleteJobSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const written = await db.job.deleteMany({
    where: { id: parsed.data.jobId, userId: user.id },
  });
  if (written.count === 0) return fail("NOT_FOUND");

  revalidateJob(parsed.data.jobId);
  return ok({ id: parsed.data.jobId });
}

/** Title, company, location, and the posting link. */
export async function updateJobIdentity(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateJobIdentitySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const data = parsed.data;
  const written = await db.job.updateMany({
    where: { id: data.jobId, userId: user.id },
    data: {
      title: data.title,
      company: data.company,
      location: data.location,
      url: data.url,
    },
  });
  if (written.count === 0) return fail("NOT_FOUND");

  await renameOpenDeadlineReminder(user.id, data.jobId, data.company);
  revalidateJob(data.jobId);
  return ok({ id: data.jobId });
}

/** Overview details. A changed deadline moves the automatic reminder. */
export async function updateJobDetails(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateJobDetailsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const data = parsed.data;
  const deadline = data.deadline ? deadlineInstant(data.deadline) : null;

  const written = await db.$transaction(async (tx) => {
    const existing = await tx.job.findFirst({
      where: { id: data.jobId, userId: user.id },
      select: { deadline: true, company: true },
    });
    if (!existing) return false;

    const updated = await tx.job.updateMany({
      where: { id: data.jobId, userId: user.id },
      data: {
        source: data.source,
        sourceDetail: data.sourceDetail,
        workMode: data.workMode,
        employmentType: data.employmentType,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryCurrency: data.salaryCurrency,
        salaryPeriod: data.salaryPeriod,
        referenceNumber: data.referenceNumber,
        deadline,
        notes: data.notes,
      },
    });
    if (updated.count === 0) return false;

    await syncDeadlineReminder(
      tx,
      user.id,
      data.jobId,
      existing.company,
      existing.deadline,
      deadline,
    );
    return true;
  });

  if (!written) return fail("NOT_FOUND");
  revalidateJob(data.jobId);
  return ok({ id: data.jobId });
}

async function syncDeadlineReminder(
  tx: DeadlineTx,
  userId: string,
  jobId: string,
  company: string,
  previous: Date | null,
  next: Date | null,
): Promise<void> {
  const plan = planDeadlineReminder(previous, next);
  if (plan.action === "keep") return;

  const open = {
    userId,
    jobId,
    kind: "DEADLINE" as const,
    autoCreated: true,
    completedAt: null,
    dismissedAt: null,
  };
  const title = deadlineReminderTitle(company);

  if (plan.action === "dismiss") {
    await tx.reminder.updateMany({
      where: open,
      data: { dismissedAt: new Date() },
    });
    return;
  }

  const moved = await tx.reminder.updateMany({
    where: open,
    data: { dueAt: plan.dueAt, title },
  });
  if (moved.count > 0) return;

  await tx.reminder.create({
    data: {
      userId,
      jobId,
      kind: "DEADLINE",
      title,
      dueAt: plan.dueAt,
      autoCreated: true,
    },
  });
}

async function renameOpenDeadlineReminder(
  userId: string,
  jobId: string,
  company: string,
): Promise<void> {
  await db.reminder.updateMany({
    where: {
      userId,
      jobId,
      kind: "DEADLINE",
      autoCreated: true,
      completedAt: null,
      dismissedAt: null,
    },
    data: { title: deadlineReminderTitle(company) },
  });
}

type DeadlineTx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
