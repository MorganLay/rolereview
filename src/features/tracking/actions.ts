"use server";

import { revalidatePath } from "next/cache";

import { strings } from "@/copy/strings";
import { calendarDateInTimeZone } from "@/features/jobs/dates";
import { applyStatusChange, type PipelineTx } from "@/features/jobs/pipeline";
import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { latestContactedAt } from "./contacts";
import { isManualEventType, MANUAL_EVENT_TYPES, manualEventInstant } from "./events";
import { snoozeDueAt } from "./reminders";
import {
  planInterviewEffects,
  zonedDateTimeInstant,
  type InterviewEffectPlan,
  type InterviewKind,
} from "./interviews";
import {
  createContactSchema,
  createCustomReminderSchema,
  createInterviewSchema,
  createTimelineEventSchema,
  deleteContactSchema,
  deleteInterviewSchema,
  linkJobContactSchema,
  logOutreachSchema,
  reminderActionSchema,
  unlinkJobContactSchema,
  updateContactSchema,
  updateInterviewSchema,
  updateJobContactRoleSchema,
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

  const timeZone = await userTimeZone(user.id);
  try {
    const eventId = await db.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { id: parsed.data.jobId, userId: user.id },
        select: { id: true },
      });
      if (!job) throw new OwnedRowMissing();
      if (parsed.data.contactId) {
        await requireLinkedContact(tx, user.id, job.id, parsed.data.contactId);
      }
      const event = await tx.jobEvent.create({
        data: {
          userId: user.id,
          jobId: job.id,
          type: parsed.data.type,
          details: parsed.data.details,
          occurredAt: manualEventInstant(parsed.data.date, timeZone),
          contactId: parsed.data.contactId,
        },
        select: { id: true },
      });
      if (parsed.data.contactId) {
        await refreshLastContacted(tx, user.id, [parsed.data.contactId]);
      }
      return event.id;
    });

    revalidatePath(`/jobs/${parsed.data.jobId}`);
    if (parsed.data.contactId) revalidatePath("/contacts");
    return ok({ eventId });
  } catch (error) {
    if (error instanceof OwnedRowMissing) return fail("NOT_FOUND");
    if (error instanceof NotLinked) {
      return fail("VALIDATION", { contactId: [strings.jobs.timeline.errors.contact] });
    }
    throw error;
  }
}

export async function updateTimelineEvent(
  input: unknown,
): Promise<ActionResult<{ eventId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateTimelineEventSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const timeZone = await userTimeZone(user.id);
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.jobEvent.findFirst({
        where: {
          id: parsed.data.eventId,
          userId: user.id,
          jobId: parsed.data.jobId,
        },
        select: { type: true, contactId: true },
      });
      if (!existing) throw new OwnedRowMissing();
      if (!isManualEventType(existing.type)) throw new LockedEvent();
      if (parsed.data.contactId) {
        await requireLinkedContact(tx, user.id, parsed.data.jobId, parsed.data.contactId);
      }
      const updated = await tx.jobEvent.updateMany({
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
          contactId: parsed.data.contactId,
        },
      });
      if (updated.count === 0) throw new LockedEvent();
      await refreshLastContacted(tx, user.id, [
        existing.contactId,
        parsed.data.contactId,
      ]);
    });

    revalidatePath(`/jobs/${parsed.data.jobId}`);
    revalidatePath("/contacts");
    return ok({ eventId: parsed.data.eventId });
  } catch (error) {
    if (error instanceof OwnedRowMissing) return fail("NOT_FOUND");
    if (error instanceof LockedEvent) return fail("CONFLICT");
    if (error instanceof NotLinked) {
      return fail("VALIDATION", { contactId: [strings.jobs.timeline.errors.contact] });
    }
    throw error;
  }
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

export async function createContact(
  input: unknown,
): Promise<ActionResult<{ contactId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = createContactSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  try {
    const contactId = await db.$transaction(async (tx) => {
      if (parsed.data.jobId) {
        const job = await tx.job.findFirst({
          where: { id: parsed.data.jobId, userId: user.id },
          select: { id: true },
        });
        if (!job) throw new OwnedRowMissing();
      }
      const contact = await tx.contact.create({
        data: {
          userId: user.id,
          name: parsed.data.name,
          title: parsed.data.title,
          company: parsed.data.company,
          email: parsed.data.email,
          phone: parsed.data.phone,
          linkedinUrl: parsed.data.linkedinUrl,
          notes: parsed.data.notes,
        },
        select: { id: true },
      });
      if (parsed.data.jobId) {
        await tx.jobContact.create({
          data: {
            userId: user.id,
            jobId: parsed.data.jobId,
            contactId: contact.id,
            role: parsed.data.role ?? "OTHER",
          },
        });
      }
      return contact.id;
    });

    revalidatePath("/contacts");
    if (parsed.data.jobId) revalidatePath(`/jobs/${parsed.data.jobId}`);
    return ok({ contactId });
  } catch (error) {
    if (error instanceof OwnedRowMissing) return fail("NOT_FOUND");
    throw error;
  }
}

export async function updateContact(
  input: unknown,
): Promise<ActionResult<{ contactId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const updated = await db.contact.updateMany({
    where: { id: parsed.data.contactId, userId: user.id },
    data: {
      name: parsed.data.name,
      title: parsed.data.title,
      company: parsed.data.company,
      email: parsed.data.email,
      phone: parsed.data.phone,
      linkedinUrl: parsed.data.linkedinUrl,
      notes: parsed.data.notes,
    },
  });
  if (updated.count === 0) return fail("NOT_FOUND");

  await revalidateContactJobs(user.id, parsed.data.contactId);
  revalidatePath("/contacts");
  return ok({ contactId: parsed.data.contactId });
}

export async function deleteContact(
  input: unknown,
): Promise<ActionResult<{ contactId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = deleteContactSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const links = await db.jobContact.findMany({
    where: { userId: user.id, contactId: parsed.data.contactId },
    select: { jobId: true },
  });
  const deleted = await db.contact.deleteMany({
    where: { id: parsed.data.contactId, userId: user.id },
  });
  if (deleted.count === 0) return fail("NOT_FOUND");

  for (const link of links) revalidatePath(`/jobs/${link.jobId}`);
  revalidatePath("/contacts");
  return ok({ contactId: parsed.data.contactId });
}

export async function linkJobContact(
  input: unknown,
): Promise<ActionResult<{ contactId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = linkJobContactSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  try {
    await db.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { id: parsed.data.jobId, userId: user.id },
        select: { id: true },
      });
      if (!job) throw new OwnedRowMissing();
      const contact = await tx.contact.findFirst({
        where: { id: parsed.data.contactId, userId: user.id },
        select: { id: true },
      });
      if (!contact) throw new OwnedRowMissing();
      const existing = await tx.jobContact.findFirst({
        where: {
          userId: user.id,
          jobId: job.id,
          contactId: contact.id,
        },
        select: { contactId: true },
      });
      if (existing) throw new AlreadyLinked();
      await tx.jobContact.create({
        data: {
          userId: user.id,
          jobId: job.id,
          contactId: contact.id,
          role: parsed.data.role,
        },
      });
    });

    revalidatePath(`/jobs/${parsed.data.jobId}`);
    revalidatePath("/contacts");
    return ok({ contactId: parsed.data.contactId });
  } catch (error) {
    if (error instanceof OwnedRowMissing) return fail("NOT_FOUND");
    if (error instanceof AlreadyLinked) return fail("CONFLICT");
    throw error;
  }
}

export async function updateJobContactRole(
  input: unknown,
): Promise<ActionResult<{ contactId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateJobContactRoleSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const updated = await db.jobContact.updateMany({
    where: {
      userId: user.id,
      jobId: parsed.data.jobId,
      contactId: parsed.data.contactId,
    },
    data: { role: parsed.data.role },
  });
  if (updated.count === 0) return fail("NOT_FOUND");

  revalidatePath(`/jobs/${parsed.data.jobId}`);
  revalidatePath("/contacts");
  return ok({ contactId: parsed.data.contactId });
}

export async function unlinkJobContact(
  input: unknown,
): Promise<ActionResult<{ contactId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = unlinkJobContactSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const deleted = await db.jobContact.deleteMany({
    where: {
      userId: user.id,
      jobId: parsed.data.jobId,
      contactId: parsed.data.contactId,
    },
  });
  if (deleted.count === 0) return fail("NOT_FOUND");

  revalidatePath(`/jobs/${parsed.data.jobId}`);
  revalidatePath("/contacts");
  return ok({ contactId: parsed.data.contactId });
}

export async function logOutreach(
  input: unknown,
): Promise<ActionResult<{ eventId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = logOutreachSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const timeZone = await userTimeZone(user.id);
  const occurredAt = manualEventInstant(
    calendarDateInTimeZone(new Date(), timeZone),
    timeZone,
  );

  try {
    const eventId = await db.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { id: parsed.data.jobId, userId: user.id },
        select: { id: true },
      });
      if (!job) throw new OwnedRowMissing();
      await requireLinkedContact(tx, user.id, job.id, parsed.data.contactId);
      const event = await tx.jobEvent.create({
        data: {
          userId: user.id,
          jobId: job.id,
          type: "FOLLOW_UP_SENT",
          details: parsed.data.details,
          occurredAt,
          contactId: parsed.data.contactId,
        },
        select: { id: true },
      });
      await refreshLastContacted(tx, user.id, [parsed.data.contactId]);
      return event.id;
    });

    revalidatePath(`/jobs/${parsed.data.jobId}`);
    revalidatePath("/contacts");
    return ok({ eventId });
  } catch (error) {
    if (error instanceof OwnedRowMissing) return fail("NOT_FOUND");
    if (error instanceof NotLinked) {
      return fail("VALIDATION", { contactId: [strings.contacts.errors.notLinked] });
    }
    throw error;
  }
}

async function requireLinkedContact(
  tx: PipelineTx,
  userId: string,
  jobId: string,
  contactId: string,
): Promise<void> {
  const contact = await tx.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!contact) throw new OwnedRowMissing();
  const link = await tx.jobContact.findFirst({
    where: { userId, jobId, contactId },
    select: { contactId: true },
  });
  if (!link) throw new NotLinked();
}

async function refreshLastContacted(
  tx: PipelineTx,
  userId: string,
  contactIds: Array<string | null>,
): Promise<void> {
  const ids = [...new Set(contactIds.filter((id): id is string => id !== null))];
  for (const contactId of ids) {
    const rows = await tx.jobEvent.findMany({
      where: { userId, contactId, type: "FOLLOW_UP_SENT" },
      select: { occurredAt: true },
    });
    await tx.contact.updateMany({
      where: { id: contactId, userId },
      data: { lastContactedAt: latestContactedAt(rows.map((row) => row.occurredAt)) },
    });
  }
}

async function revalidateContactJobs(userId: string, contactId: string): Promise<void> {
  const links = await db.jobContact.findMany({
    where: { userId, contactId },
    select: { jobId: true },
  });
  for (const link of links) revalidatePath(`/jobs/${link.jobId}`);
}

export async function createCustomReminder(
  input: unknown,
): Promise<ActionResult<{ reminderId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = createCustomReminderSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const timeZone = await userTimeZone(user.id);
  try {
    const reminderId = await db.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { id: parsed.data.jobId, userId: user.id },
        select: { id: true },
      });
      if (!job) throw new OwnedRowMissing();
      const reminder = await tx.reminder.create({
        data: {
          userId: user.id,
          jobId: job.id,
          kind: "CUSTOM",
          title: parsed.data.title,
          dueAt: manualEventInstant(parsed.data.date, timeZone),
          autoCreated: false,
        },
        select: { id: true },
      });
      return reminder.id;
    });

    revalidateReminderViews(parsed.data.jobId);
    return ok({ reminderId });
  } catch (error) {
    if (error instanceof OwnedRowMissing) return fail("NOT_FOUND");
    throw error;
  }
}

export async function completeReminder(
  input: unknown,
): Promise<ActionResult<{ reminderId: string }>> {
  return closeOrMoveReminder(input, (now) => ({ completedAt: now }));
}

export async function snoozeReminder(
  input: unknown,
): Promise<ActionResult<{ reminderId: string }>> {
  return closeOrMoveReminder(input, (now) => ({ dueAt: snoozeDueAt(now) }));
}

export async function dismissReminder(
  input: unknown,
): Promise<ActionResult<{ reminderId: string }>> {
  return closeOrMoveReminder(input, (now) => ({ dismissedAt: now }));
}

async function closeOrMoveReminder(
  input: unknown,
  change: (now: Date) => { completedAt: Date } | { dismissedAt: Date } | { dueAt: Date },
): Promise<ActionResult<{ reminderId: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = reminderActionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const now = new Date();
  const existing = await db.reminder.findFirst({
    where: {
      id: parsed.data.reminderId,
      userId: user.id,
      completedAt: null,
      dismissedAt: null,
    },
    select: { jobId: true },
  });
  if (!existing) return fail("NOT_FOUND");

  const updated = await db.reminder.updateMany({
    where: {
      id: parsed.data.reminderId,
      userId: user.id,
      completedAt: null,
      dismissedAt: null,
    },
    data: change(now),
  });
  if (updated.count === 0) return fail("NOT_FOUND");

  revalidateReminderViews(existing.jobId);
  return ok({ reminderId: parsed.data.reminderId });
}

function revalidateReminderViews(jobId: string | null) {
  revalidatePath("/dashboard");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

class OwnedRowMissing extends Error {
  constructor() {
    super("Owned row missing");
    this.name = "OwnedRowMissing";
  }
}

class NotLinked extends Error {
  constructor() {
    super("Contact is not linked");
    this.name = "NotLinked";
  }
}

class AlreadyLinked extends Error {
  constructor() {
    super("Contact is already linked");
    this.name = "AlreadyLinked";
  }
}

class LockedEvent extends Error {
  constructor() {
    super("Event is automatic");
    this.name = "LockedEvent";
  }
}
