import "server-only";

import { connection } from "next/server";

import { calendarDateInTimeZone } from "@/features/jobs/dates";
import { db } from "@/lib/db";

import { compareTimelineEvents, presentTimelineEvent, type TimelineEventView } from "./events";

export type JobTimeline = {
  events: TimelineEventView[];
  today: string;
};

/** Timeline rows for one owned job, newest first. */
export async function listJobTimeline(userId: string, jobId: string): Promise<JobTimeline> {
  await connection();
  const [owner, rows] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }),
    db.jobEvent.findMany({
      where: { userId, jobId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        type: true,
        fromStatus: true,
        toStatus: true,
        details: true,
        occurredAt: true,
        createdAt: true,
      },
    }),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const ordered = [...rows].sort(compareTimelineEvents);

  return {
    today: calendarDateInTimeZone(new Date(), timeZone),
    events: ordered.map((row) => presentTimelineEvent(row, timeZone)),
  };
}
