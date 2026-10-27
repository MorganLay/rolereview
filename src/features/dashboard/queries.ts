import "server-only";

import { connection } from "next/server";

import { displayedAnalysisStatus } from "@/features/jobs/analyze";
import { formatDeadlineDate } from "@/features/jobs/dates";
import { isJobStatus } from "@/features/jobs/schemas";
import { isManualEventType } from "@/features/tracking/events";
import { db } from "@/lib/db";

import { onboardingSteps, thisWeek, type OnboardingStep, type ThisWeek } from "./metrics";
import {
  continueWorking,
  dashboardActions,
  dashboardSummary,
  recentActivity,
  type ActivityItem,
  type ContinueWork,
  type DashboardAction,
  type DashboardSummary,
  type HomeJob,
} from "./priorities";

export type DashboardData = {
  timeZone: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt: Date | null;
  /** When the figures were computed. Used to show the setup line on that visit. */
  asOf: Date;
  steps: OnboardingStep[];
  summary: DashboardSummary;
  actions: DashboardAction[];
  continueWork: ContinueWork | null;
  activity: ActivityItem[];
  week: ThisWeek;
};

/** Home screen for one user. Archived jobs stay out of the returning sections. */
export async function getDashboard(userId: string): Promise<DashboardData> {
  await connection();
  const now = new Date();
  const [owner, entries, readyResumes, exportedResumes, rows, eventRows] = await Promise.all([
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
        analysisStatus: true,
        offer: { select: { respondBy: true } },
        reminders: {
          where: { completedAt: null, dismissedAt: null },
          select: { id: true, kind: true, title: true, dueAt: true },
        },
        interviews: {
          select: { id: true, round: true, kind: true, scheduledAt: true },
        },
        tailoredResumes: {
          where: { status: "READY" },
          select: {
            id: true,
            version: true,
            exportedAt: true,
            submittedAt: true,
            updatedAt: true,
          },
        },
      },
    }),
    db.jobEvent.findMany({
      where: { userId, job: { archivedAt: null } },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 40,
      select: {
        id: true,
        type: true,
        occurredAt: true,
        createdAt: true,
        jobId: true,
        job: { select: { company: true, title: true, archivedAt: true } },
      },
    }),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const jobs = rows.flatMap((row) => toHomeJob(row, now));
  const actions = dashboardActions(jobs, now, timeZone);

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
    summary: dashboardSummary(jobs, actions),
    actions,
    continueWork: continueWorking(jobs),
    activity: recentActivity(
      eventRows.flatMap((event) => {
        if (!event.job) return [];
        return [
          {
            id: event.id,
            jobId: event.jobId,
            company: event.job.company,
            title: event.job.title,
            type: event.type,
            occurredAt: event.occurredAt,
            createdAt: event.createdAt,
            manual: isManualEventType(event.type),
            archived: event.job.archivedAt !== null,
          },
        ];
      }),
    ),
    week: thisWeek(jobs, now, timeZone),
  };
}

type JobRow = {
  id: string;
  company: string;
  title: string;
  status: string;
  archivedAt: Date | null;
  appliedAt: Date | null;
  firstResponseAt: Date | null;
  submittedResumeId: string | null;
  deadline: Date | null;
  updatedAt: Date;
  analysisStatus: string;
  offer: { respondBy: Date | null } | null;
  reminders: { id: string; kind: string; title: string; dueAt: Date }[];
  interviews: { id: string; round: number; kind: string; scheduledAt: Date | null }[];
  tailoredResumes: {
    id: string;
    version: number;
    exportedAt: Date | null;
    submittedAt: Date | null;
    updatedAt: Date;
  }[];
};

function toHomeJob(row: JobRow, now: Date): HomeJob[] {
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
      analysisReady: readyAnalysis(row.analysisStatus, row.updatedAt, now),
      hasOffer: row.offer !== null,
      deadline: row.deadline ? formatDeadlineDate(row.deadline) : null,
      respondBy: row.offer?.respondBy ? formatDeadlineDate(row.offer.respondBy) : null,
      updatedAt: row.updatedAt,
      reminders: row.reminders.map((reminder) => ({
        id: reminder.id,
        kind: reminder.kind,
        title: reminder.title,
        dueAt: reminder.dueAt,
        open: true,
      })),
      interviews: row.interviews.flatMap((interview) => {
        if (!interview.scheduledAt) return [];
        return [
          {
            id: interview.id,
            round: interview.round,
            kind: interview.kind,
            scheduledAt: interview.scheduledAt,
          },
        ];
      }),
      resumes: row.tailoredResumes.map((resume) => ({
        id: resume.id,
        version: resume.version,
        exported: resume.exportedAt !== null,
        submitted: resume.submittedAt !== null,
        updatedAt: resume.updatedAt,
      })),
    },
  ];
}

function readyAnalysis(status: string, updatedAt: Date, now: Date): boolean {
  if (status !== "PENDING" && status !== "READY" && status !== "FAILED") return false;
  return displayedAnalysisStatus(status, updatedAt, now) === "READY";
}
