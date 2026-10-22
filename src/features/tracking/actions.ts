"use server";

import { revalidatePath } from "next/cache";

import { strings } from "@/copy/strings";
import { applyStatusChange, type PipelineTx } from "@/features/jobs/pipeline";
import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { MANUAL_EVENT_TYPES, manualEventInstant } from "./events";
import {
  planInterviewEffects,
  zonedDateTimeInstant,
  type InterviewEffectPlan,
  type InterviewKind,
} from "./interviews";
import {
  createInterviewSchema,
  createTimelineEventSchema,
  deleteInterviewSchema,
  updateInterviewSchema,
  updateTimelineEventSchema,
  zodFieldErrors,
} from "./schemas";

export async function createTimelineEvent(
  input: unknown,
): Promise<ActionResult<{ eventId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = createTimelineEventSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const job = await db.job.findFirst({
    where: { id: parsed.data.jobId, userId: user.id },
    select: { id: true },
  });
  if (!job) return fail("NOT_FOUND");

  const timeZone = await userTimeZone(user.id);
  const event = await db.jobEvent.create({
    data: {
      userId: user.id,
      jobId: job.id,
      type: parsed.data.type,
      details: parsed.data.details,
      occurredAt: manualEventInstant(parsed.data.date, timeZone),
    },
    select: { id: true },
  });

  revalidatePath(`/jobs/${job.id}`);
  return ok({ eventId: event.id });
}

export async function updateTimelineEvent(
  input: unknown,
): Promise<ActionResult<{ eventId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateTimelineEventSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const timeZone = await userTimeZone(user.id);
  const updated = await db.jobEvent.updateMany({
    where: {
      id: parsed.data.eventId,
      userId: user.id,
      jobId: parsed.data.jobId,
      type: { in: [...MANUAL_EVENT_TYPES] },
    },
    data: {
      type: parsed.data.type,
      details: parsed.data.details,
      occurredAt: manualEventInstant(parsed.data.date, timeZone),
    },
  });
  if (updated.count === 0) {
    const existing = await db.jobEvent.findFirst({
      where: {
        id: parsed.data.eventId,
        userId: user.id,
        jobId: parsed.data.jobId,
      },
      select: { id: true },
    });
    return existing ? fail("CONFLICT") : fail("NOT_FOUND");
  }

  revalidatePath(`/jobs/${parsed.data.jobId}`);
  return ok({ eventId: parsed.data.eventId });
}

async function userTimeZone(userId: string): Promise<string> {
  const owner = await db.user.findFirst({
    where: { id: userId },
    select: { timezone: true },
  });
  return owner?.timezone || "America/Toronto";
}

export async function createInterview(
  input: unknown,
): Promise<ActionResult<{ interviewId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = createInterviewSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const timeZone = await userTimeZone(user.id);
  const scheduledAt = readScheduledAt(parsed.data.scheduledAt, timeZone);
  if (scheduledAt === undefined) {
    return fail("VALIDATION", { scheduledAt: [strings.jobs.interviews.errors.dateTime] });
  }

  const now = new Date();
  try {
    const interviewId = await db.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { id: parsed.data.jobId, userId: user.id },
        select: { id: true, status: true },
      });
      if (!job) throw new OwnedRowMissing();

      const interview = await tx.interview.create({
        data: {
          userId: user.id,
          jobId: job.id,
          round: parsed.data.round,
          kind: parsed.data.kind,
          scheduledAt,
          durationMinutes: parsed.data.durationMinutes,
          locationOrLink: parsed.data.locationOrLink,
          interviewers: parsed.data.interviewers,
          prepNotes: parsed.data.prepNotes,
          reflection: parsed.data.reflection,
          outcome: parsed.data.outcome,
        },
        select: { id: true },
      });

      const plan = planInterviewEffects({
        previous: { scheduledAt: null, outcome: "PENDING" },
        next: { scheduledAt, outcome: parsed.data.outcome },
        status: job.status,
        now,
        timeZone,
        alreadyScheduled: false,
        alreadyCompleted: false,
      });
      await writeInterviewEffects(tx, {
        userId: user.id,
        jobId: job.id,
        interviewId: interview.id,
        round: parsed.data.round,
        kind: parsed.data.kind,
        plan,
        now,
      });
      return interview.id;
    });

    revalidatePath(`/jobs/${parsed.data.jobId}`);
    revalidatePath("/jobs");
    return ok({ interviewId });
  } catch (error) {
    if (error instanceof OwnedRowMissing) return fail("NOT_FOUND");
    throw error;
  }
}

export async function updateInterview(
  input: unknown,
): Promise<ActionResult<{ interviewId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateInterviewSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const timeZone = await userTimeZone(user.id);
  const scheduledAt = readScheduledAt(parsed.data.scheduledAt, timeZone);
  if (scheduledAt === undefined) {
    return fail("VALIDATION", { scheduledAt: [strings.jobs.interviews.errors.dateTime] });
  }

  const now = new Date();
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.interview.findFirst({
        where: {
          id: parsed.data.interviewId,
          userId: user.id,
          jobId: parsed.data.jobId,
        },
        select: {
          scheduledAt: true,
          outcome: true,
          job: { select: { status: true } },
        },
      });
      if (!existing) throw new OwnedRowMissing();

      const updated = await tx.interview.updateMany({
        where: {
          id: parsed.data.interviewId,
          userId: user.id,
          jobId: parsed.data.jobId,
        },
        data: {
          round: parsed.data.round,
          kind: parsed.data.kind,
          scheduledAt,
          durationMinutes: parsed.data.durationMinutes,
          locationOrLink: parsed.data.locationOrLink,
          interviewers: parsed.data.interviewers,
          prepNotes: parsed.data.prepNotes,
          reflection: parsed.data.reflection,
          outcome: parsed.data.outcome,
        },
      });
      if (updated.count === 0) throw new OwnedRowMissing();

      const scheduled = await tx.jobEvent.findFirst({
        where: {
          userId: user.id,
          interviewId: parsed.data.interviewId,
          type: "INTERVIEW_SCHEDULED",
        },
        select: { id: true },
      });
      const completed = await tx.jobEvent.findFirst({
        where: {
          userId: user.id,
          interviewId: parsed.data.interviewId,
          type: "INTERVIEW_COMPLETED",
        },
        select: { id: true },
      });

      const plan = planInterviewEffects({
        previous: {
          scheduledAt: existing.scheduledAt,
          outcome: existing.outcome,
        },
        next: { scheduledAt, outcome: parsed.data.outcome },
        status: existing.job.status,
        now,
        timeZone,
        alreadyScheduled: scheduled !== null,
        alreadyCompleted: completed !== null,
      });
      await writeInterviewEffects(tx, {
        userId: user.id,
        jobId: parsed.data.jobId,
        interviewId: parsed.data.interviewId,
        round: parsed.data.round,
        kind: parsed.data.kind,
        plan,
        now,
      });
    });

    revalidatePath(`/jobs/${parsed.data.jobId}`);
    revalidatePath("/jobs");
    return ok({ interviewId: parsed.data.interviewId });
  } catch (error) {
    if (error instanceof OwnedRowMissing) return fail("NOT_FOUND");
    throw error;
  }
}

export async function deleteInterview(
  input: unknown,
): Promise<ActionResult<{ interviewId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = deleteInterviewSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const deleted = await db.interview.deleteMany({
    where: {
      id: parsed.data.interviewId,
      userId: user.id,
      jobId: parsed.data.jobId,
    },
  });
  if (deleted.count === 0) return fail("NOT_FOUND");

  revalidatePath(`/jobs/${parsed.data.jobId}`);
  revalidatePath("/jobs");
  return ok({ interviewId: parsed.data.interviewId });
}

/** Blank stays null. A daylight-saving gap is `undefined`. */
function readScheduledAt(value: string, timeZone: string): Date | null | undefined {
  if (!value) return null;
  return zonedDateTimeInstant(value, timeZone) ?? undefined;
}

async function writeInterviewEffects(
  tx: PipelineTx,
  args: {
    userId: string;
    jobId: string;
    interviewId: string;
    round: number;
    kind: InterviewKind;
    plan: InterviewEffectPlan;
    now: Date;
  },
): Promise<void> {
  const details = strings.jobs.interviews.eventLine(
    args.round,
    strings.jobs.interviews.kinds[args.kind],
  );

  if (args.plan.scheduleEvent) {
    await tx.jobEvent.create({
      data: {
        userId: args.userId,
        jobId: args.jobId,
        interviewId: args.interviewId,
        type: "INTERVIEW_SCHEDULED",
        details,
        occurredAt: args.now,
      },
    });
  }

  if (args.plan.completeEvent) {
    await tx.jobEvent.create({
      data: {
        userId: args.userId,
        jobId: args.jobId,
        interviewId: args.interviewId,
        type: "INTERVIEW_COMPLETED",
        details,
        occurredAt: args.now,
      },
    });
  }

  if (args.plan.interviewReminder === "dismiss") {
    await tx.reminder.updateMany({
      where: {
        userId: args.userId,
        interviewId: args.interviewId,
        kind: "INTERVIEW",
        autoCreated: true,
        completedAt: null,
        dismissedAt: null,
      },
      data: { dismissedAt: args.now },
    });
  }

  if (args.plan.interviewReminder === "upsert" && args.plan.interviewReminderDueAt) {
    const updated = await tx.reminder.updateMany({
      where: {
        userId: args.userId,
        interviewId: args.interviewId,
        kind: "INTERVIEW",
        autoCreated: true,
        completedAt: null,
        dismissedAt: null,
      },
      data: { dueAt: args.plan.interviewReminderDueAt },
    });
    if (updated.count === 0) {
      await tx.reminder.create({
        data: {
          userId: args.userId,
          jobId: args.jobId,
          interviewId: args.interviewId,
          kind: "INTERVIEW",
          title: strings.jobs.reminder.interview,
          dueAt: args.plan.interviewReminderDueAt,
          autoCreated: true,
        },
      });
    }
  }

  if (args.plan.thankYouDueAt) {
    await tx.reminder.create({
      data: {
        userId: args.userId,
        jobId: args.jobId,
        interviewId: args.interviewId,
        kind: "THANK_YOU",
        title: strings.jobs.reminder.thankYou,
        dueAt: args.plan.thankYouDueAt,
        autoCreated: true,
      },
    });
  }

  if (args.plan.advanceToInterviewing) {
    const moved = await applyStatusChange(args.userId, args.jobId, "INTERVIEWING", {
      now: args.now,
      tx,
    });
    if (!moved) throw new OwnedRowMissing();
  }
}

class OwnedRowMissing extends Error {
  constructor() {
    super("Owned row missing");
    this.name = "OwnedRowMissing";
  }
}
