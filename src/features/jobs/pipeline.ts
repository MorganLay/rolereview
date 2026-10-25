/**
 * Status side effects. docs/04-DATA-MODEL.md → Automatic side effects.
 * Interview and offer creation call this with the open transaction.
 */

import "server-only";

import { strings } from "@/copy/strings";
import { type Prisma } from "@/generated/prisma/client";
import type { JobStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { isClosedJobStatus } from "./schemas";

const FOLLOW_UP_MS = 7 * 24 * 60 * 60 * 1000;

/** Statuses that count as a first response when leaving APPLIED. */
const RESPONSE_FROM_APPLIED: ReadonlySet<JobStatus> = new Set([
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
]);

export type PipelineJob = {
  status: JobStatus;
  appliedAt: Date | null;
  firstResponseAt: Date | null;
  closedAt: Date | null;
  submittedResumeId: string | null;
};

export type JobPatch = {
  status: JobStatus;
  appliedAt?: Date;
  firstResponseAt?: Date;
  closedAt?: Date;
  closeReason?: string | null;
  submittedResumeId?: string;
};

export type PlannedEvent = {
  type: "STATUS_CHANGED" | "APPLIED" | "RESPONSE_RECEIVED";
  fromStatus?: JobStatus;
  toStatus?: JobStatus;
};

export type StatusChangePlan =
  | { changed: false }
  | {
      changed: true;
      patch: JobPatch;
      events: PlannedEvent[];
      followUpDueAt: Date | null;
      completeAutoFollowUps: boolean;
      dismissOpenReminders: boolean;
      /** Latest READY resume with exportedAt, only the first time appliedAt is set. */
      selectSubmittedResume: boolean;
    };

/** Interactive-transaction client. Interview writes pass the one they already opened. */
export type PipelineTx = Prisma.TransactionClient;

export type ApplyStatusOpts = {
  /** Stored only when entering a closed status. Blank becomes null. */
  closeReason?: string | null;
  /** Server clock. Tests pass a fixed instant. */
  now?: Date;
  /** When set, the status write joins this transaction. */
  tx?: PipelineTx;
};

export type ApplyStatusResult = {
  jobId: string;
  status: JobStatus;
  changed: boolean;
};

/** Pure side-effect plan for one status change. `now` is the clock for dates. */
export function planStatusChange(
  job: PipelineJob,
  toStatus: JobStatus,
  opts: { now: Date; closeReason?: string | null },
): StatusChangePlan {
  if (job.status === toStatus) return { changed: false };

  const patch: JobPatch = { status: toStatus };
  const events: PlannedEvent[] = [
    { type: "STATUS_CHANGED", fromStatus: job.status, toStatus },
  ];
  let followUpDueAt: Date | null = null;
  let completeAutoFollowUps = false;
  let dismissOpenReminders = false;
  let selectSubmittedResume = false;

  if (toStatus === "APPLIED" && job.appliedAt == null) {
    patch.appliedAt = opts.now;
    events.push({ type: "APPLIED" });
    followUpDueAt = new Date(opts.now.getTime() + FOLLOW_UP_MS);
    selectSubmittedResume = job.submittedResumeId == null;
  }

  if (
    job.status === "APPLIED" &&
    RESPONSE_FROM_APPLIED.has(toStatus) &&
    job.firstResponseAt == null
  ) {
    patch.firstResponseAt = opts.now;
    events.push({ type: "RESPONSE_RECEIVED" });
    completeAutoFollowUps = true;
  }

  if (isClosedJobStatus(toStatus)) {
    if (job.closedAt == null) patch.closedAt = opts.now;
    if (opts.closeReason !== undefined) {
      const trimmed = opts.closeReason?.trim() ?? "";
      patch.closeReason = trimmed.length > 0 ? trimmed : null;
    }
    dismissOpenReminders = true;
  }

  return {
    changed: true,
    patch,
    events,
    followUpDueAt,
    completeAutoFollowUps,
    dismissOpenReminders,
    selectSubmittedResume,
  };
}

/**
 * Apply a status change for one owned job. Missing job → null.
 * Same status again changes nothing (no second reminder, dates stay).
 */
export async function applyStatusChange(
  userId: string,
  jobId: string,
  toStatus: JobStatus,
  opts?: ApplyStatusOpts,
): Promise<ApplyStatusResult | null> {
  const now = opts?.now ?? new Date();
  if (opts?.tx) {
    return applyStatusChangeOn(opts.tx, userId, jobId, toStatus, now, opts.closeReason);
  }
  return db.$transaction((tx) =>
    applyStatusChangeOn(tx, userId, jobId, toStatus, now, opts?.closeReason),
  );
}

async function applyStatusChangeOn(
  tx: PipelineTx,
  userId: string,
  jobId: string,
  toStatus: JobStatus,
  now: Date,
  closeReason: string | null | undefined,
): Promise<ApplyStatusResult | null> {
  const job = await tx.job.findFirst({
    where: { id: jobId, userId },
    select: {
      status: true,
      appliedAt: true,
      firstResponseAt: true,
      closedAt: true,
      submittedResumeId: true,
    },
  });
  if (!job) return null;

  const plan = planStatusChange(job, toStatus, { now, closeReason });
  if (!plan.changed) {
    return { jobId, status: job.status, changed: false };
  }

  let submittedResumeId: string | undefined;
  if (plan.selectSubmittedResume) {
    const resume = await tx.tailoredResume.findFirst({
      where: {
        userId,
        jobId,
        status: "READY",
        exportedAt: { not: null },
      },
      orderBy: [{ exportedAt: "desc" }, { version: "desc" }],
      select: { id: true },
    });
    if (resume) {
      submittedResumeId = resume.id;
      await tx.tailoredResume.updateMany({
        where: { id: resume.id, userId, submittedAt: null },
        data: { submittedAt: now },
      });
    }
  }

  const updated = await tx.job.updateMany({
    where: { id: jobId, userId },
    data: {
      ...plan.patch,
      ...(submittedResumeId ? { submittedResumeId } : {}),
    },
  });
  if (updated.count === 0) return null;

  for (const event of plan.events) {
    await tx.jobEvent.create({
      data: {
        userId,
        jobId,
        type: event.type,
        ...(event.fromStatus ? { fromStatus: event.fromStatus } : {}),
        ...(event.toStatus ? { toStatus: event.toStatus } : {}),
      },
    });
  }

  if (plan.followUpDueAt) {
    await tx.reminder.create({
      data: {
        userId,
        jobId,
        kind: "FOLLOW_UP",
        title: strings.jobs.reminder.followUp,
        dueAt: plan.followUpDueAt,
        autoCreated: true,
      },
    });
  }

  if (plan.completeAutoFollowUps) {
    await tx.reminder.updateMany({
      where: {
        userId,
        jobId,
        kind: "FOLLOW_UP",
        autoCreated: true,
        completedAt: null,
        dismissedAt: null,
      },
      data: { completedAt: now },
    });
  }

  if (plan.dismissOpenReminders) {
    await tx.reminder.updateMany({
      where: {
        userId,
        jobId,
        completedAt: null,
        dismissedAt: null,
      },
      data: { dismissedAt: now },
    });
  }

  return { jobId, status: toStatus, changed: true };
}
