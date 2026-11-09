import "server-only";

import { connection } from "next/server";

import { displayedAnalysisStatus } from "@/features/jobs/analyze";
import { formatDeadlineDate } from "@/features/jobs/dates";
import { isJobStatus } from "@/features/jobs/schemas";
import { libraryHealth } from "@/features/library/health";
import { getLibrary } from "@/features/library/queries";
import { displayedTailorStatus } from "@/features/tailor/status";
import { db } from "@/lib/db";

import { libraryOverview, type LibraryOverview } from "./library-overview";
import { onboardingSteps, thisWeek, type OnboardingStep, type ThisWeek } from "./metrics";
import {
  attentionItems,
  continueWorking,
  dashboardActions,
  dashboardSummary,
  recentApplications,
  type ContinueWork,
  type DashboardAction,
  type DashboardSummary,
  type HomeJob,
  type RecentApplication,
} from "./priorities";

export type DashboardData = {
  timeZone: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt: Date | null;
  /** When the figures were computed. Used to show the setup line on that visit. */
  asOf: Date;
  steps: OnboardingStep[];
  summary: DashboardSummary;
  /** Jobs that are not archived, including closed ones. */
  tracked: number;
  actions: DashboardAction[];
  attention: DashboardAction[];
  continueWork: ContinueWork | null;
  recent: RecentApplication[];
  week: ThisWeek;
  library: LibraryOverview;
};

/** Home screen for one user. Archived jobs stay out of the returning sections. */
export async function getDashboard(userId: string): Promise<DashboardData> {
  await connection();
  const now = new Date();
  const [owner, library, entries, readyResumes, exportedResumes, rows] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true, onboardingCompletedAt: true },
    }),
    getLibrary(userId),
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
          select: {
            id: true,
            version: true,
            status: true,
            exportedAt: true,
            submittedAt: true,
            updatedAt: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const jobs = rows.flatMap((row) => toHomeJob(row, now));
  const actions = dashboardActions(jobs, now, timeZone);
  const health = library ? libraryHealth(library) : null;
  const populated =
    library !== null && (library.entries.length > 0 || library.skills.length > 0);

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
    tracked: jobs.filter((job) => !job.archived).length,
    actions,
    attention: attentionItems(actions),
    continueWork: continueWorking(jobs),
    recent: recentApplications(jobs),
    week: thisWeek(
      jobs,
      now,
      timeZone,
      rows.flatMap((row) =>
        row.archivedAt
          ? []
          : row.tailoredResumes.flatMap((resume) =>
              resume.status === "READY" ? [resume.createdAt] : [],
            ),
      ),
    ),
    library: libraryOverview({
      populated,
      percent: health?.percent ?? 0,
      strongOrBetter: health?.strongOrBetter ?? 0,
      bulletCount: health?.bulletCount ?? 0,
      wording: health?.weakest.length ?? 0,
      evidence: health?.evidenceGaps ?? 0,
    }),
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
    status: string;
    exportedAt: Date | null;
    submittedAt: Date | null;
    updatedAt: Date;
    createdAt: Date;
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
      tailoringUpdatedAt: newestTailoring(row.tailoredResumes, now),
      resumes: row.tailoredResumes.flatMap((resume) => {
        if (resume.status !== "READY" || resume.id.length === 0) return [];
        return [
          {
            id: resume.id,
            version: resume.version,
            exported: resume.exportedAt !== null,
            submitted: resume.submittedAt !== null,
            updatedAt: resume.updatedAt,
          },
        ];
      }),
    },
  ];
}

function newestTailoring(
  resumes: readonly { status: string; updatedAt: Date }[],
  now: Date,
): Date | null {
  let latest: Date | null = null;
  for (const resume of resumes) {
    if (resume.status !== "PENDING" && resume.status !== "READY" && resume.status !== "FAILED") {
      continue;
    }
    if (displayedTailorStatus(resume.status, resume.updatedAt, now) !== "PENDING") continue;
    if (!latest || resume.updatedAt.getTime() > latest.getTime()) latest = resume.updatedAt;
  }
  return latest;
}

function readyAnalysis(status: string, updatedAt: Date, now: Date): boolean {
  if (status !== "PENDING" && status !== "READY" && status !== "FAILED") return false;
  return displayedAnalysisStatus(status, updatedAt, now) === "READY";
}
