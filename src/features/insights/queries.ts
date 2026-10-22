import "server-only";

import { connection } from "next/server";

import { db } from "@/lib/db";

import {
  insightsMetrics,
  toInsightsJob,
  type InsightsMetrics,
  type InsightsRange,
} from "./metrics";

export type InsightsData = InsightsMetrics & {
  timeZone: string;
  range: InsightsRange;
  /** At least one job has appliedAt at or before now, on any range. */
  everApplied: boolean;
  asOf: Date;
};

/**
 * Insights for one user. Archived jobs stay in the figures.
 * The page calls `requireUser()` before this. The activity streak is 1.1.
 */
export async function getInsights(userId: string, range: InsightsRange): Promise<InsightsData> {
  await connection();
  const now = new Date();
  const [owner, rows] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }),
    db.job.findMany({
      where: { userId },
      select: {
        status: true,
        source: true,
        appliedAt: true,
        createdAt: true,
        firstResponseAt: true,
        submittedResumeId: true,
        submittedResume: { select: { matchScore: true } },
        _count: { select: { interviews: true } },
        events: {
          where: {
            userId,
            OR: [
              { type: "OFFER_RECEIVED" },
              { toStatus: { in: ["OFFER", "ACCEPTED"] } },
            ],
          },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const jobs = rows.flatMap((row) => {
    const job = toInsightsJob({
      status: row.status,
      source: row.source,
      appliedAt: row.appliedAt,
      createdAt: row.createdAt,
      firstResponseAt: row.firstResponseAt,
      submittedResumeId: row.submittedResumeId,
      matchScore: row.submittedResume?.matchScore ?? null,
      interviewCount: row._count.interviews,
      offerEvent: row.events.length > 0,
    });
    return job ? [job] : [];
  });

  return {
    timeZone,
    range,
    everApplied: jobs.some(
      (job) => job.appliedAt !== null && job.appliedAt.getTime() <= now.getTime(),
    ),
    asOf: now,
    ...insightsMetrics(jobs, { range, now, timeZone }),
  };
}
