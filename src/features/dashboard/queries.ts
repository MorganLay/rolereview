import "server-only";

import { connection } from "next/server";

import { formatDeadlineDate } from "@/features/jobs/dates";
import {
  isJobStatus,
  type BoardStage,
  type JobStatusValue,
} from "@/features/jobs/schemas";
import { libraryHealth } from "@/features/library/health";
import { getLibrary } from "@/features/library/queries";
import { db } from "@/lib/db";

import {
  dashboardNudges,
  HEALTH_NUDGE_BELOW,
  onboardingSteps,
  pipelineCounts,
  recentJobs,
  thisWeek,
  type Nudge,
  type OnboardingStep,
  type ThisWeek,
} from "./metrics";

export type DashboardRecentJob = {
  id: string;
  company: string;
  title: string;
  status: JobStatusValue;
};

export type DashboardHealth = {
  percent: number;
};

export type DashboardData = {
  timeZone: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt: Date | null;
  /** When the figures were computed. Used to show the setup line on that visit. */
  asOf: Date;
  steps: OnboardingStep[];
  nudges: Nudge[];
  pipeline: Record<BoardStage, number>;
  week: ThisWeek;
  recent: DashboardRecentJob[];
  health: DashboardHealth | null;
};

/** Home screen figures for one user. Archived jobs stay out of the returning sections. */
export async function getDashboard(userId: string): Promise<DashboardData> {
  await connection();
  const now = new Date();
  const [owner, entries, readyResumes, exportedResumes, rows, library] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true, onboardingCompletedAt: true },
    }),
    db.entry.count({ where: { userId } }),
    db.tailoredResume.count({ where: { userId, status: "READY" } }),
    db.tailoredResume.count({ where: { userId, exportedAt: { not: null } } }),
    db.job.findMany({
      where: { userId },
      select: {
        id: true,
        company: true,
        title: true,
        status: true,
        archivedAt: true,
        appliedAt: true,
        firstResponseAt: true,
        submittedResumeId: true,
        deadline: true,
        updatedAt: true,
        offer: { select: { respondBy: true } },
      },
    }),
    getLibrary(userId),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const jobs = rows.flatMap((row) => {
    if (!isJobStatus(row.status)) return [];
    return [
      {
        id: row.id,
        company: row.company,
        title: row.title,
        status: row.status,
        archived: row.archivedAt !== null,
        appliedAt: row.appliedAt,
        firstResponseAt: row.firstResponseAt,
        submittedResumeId: row.submittedResumeId,
        deadline: row.deadline ? formatDeadlineDate(row.deadline) : null,
        respondBy: row.offer?.respondBy ? formatDeadlineDate(row.offer.respondBy) : null,
        updatedAt: row.updatedAt,
      },
    ];
  });

  const scored = library ? libraryHealth(library) : null;

  return {
    timeZone,
    onboardingCompleted: owner?.onboardingCompletedAt != null,
    onboardingCompletedAt: owner?.onboardingCompletedAt ?? null,
    asOf: now,
    steps: onboardingSteps({
      entries,
      jobs: rows.length,
      readyResumes,
      exportedResumes,
    }),
    nudges: dashboardNudges(jobs, now, timeZone),
    pipeline: pipelineCounts(jobs),
    week: thisWeek(jobs, now, timeZone),
    recent: recentJobs(jobs).map((job) => ({
      id: job.id,
      company: job.company,
      title: job.title,
      status: job.status,
    })),
    health:
      scored && scored.percent < HEALTH_NUDGE_BELOW
        ? { percent: scored.percent }
        : null,
  };
}
