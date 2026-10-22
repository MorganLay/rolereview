import "server-only";

import { connection } from "next/server";

import { calendarDateInTimeZone } from "@/features/jobs/dates";
import { db } from "@/lib/db";

import { compareTimelineEvents, presentTimelineEvent, type TimelineEventView } from "./events";
import {
  compareInterviews,
  nextInterviewRound,
  presentInterview,
  type InterviewView,
} from "./interviews";

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

export type JobInterviews = {
  interviews: InterviewView[];
  timeZone: string;
  now: string;
  nextRound: number;
};

/** Interviews for one owned job, by round then time. */
export async function listJobInterviews(
  userId: string,
  jobId: string,
): Promise<JobInterviews> {
  await connection();
  const now = new Date();
  const [owner, rows] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }),
    db.interview.findMany({
      where: { userId, jobId },
      select: {
        id: true,
        round: true,
        kind: true,
        outcome: true,
        scheduledAt: true,
        durationMinutes: true,
        locationOrLink: true,
        interviewers: true,
        prepNotes: true,
        reflection: true,
        createdAt: true,
      },
    }),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const ordered = [...rows].sort(compareInterviews);

  return {
    timeZone,
    now: now.toISOString(),
    nextRound: nextInterviewRound(ordered.map((row) => row.round)),
    interviews: ordered.map((row) => presentInterview(row, timeZone, now)),
  };
}
