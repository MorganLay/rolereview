"use server";

import { revalidatePath } from "next/cache";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { MANUAL_EVENT_TYPES, manualEventInstant } from "./events";
import {
  createTimelineEventSchema,
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
