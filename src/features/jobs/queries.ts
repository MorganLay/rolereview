import "server-only";

import { quotaSnapshot } from "@/features/billing/quota";
import type {
  EmploymentType,
  JobSource,
  JobStatus,
  PayPeriod,
  Plan,
  WorkMode,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { canRetryAnalysis, displayedAnalysisStatus } from "./analyze";
import { formatDeadlineDate } from "./dates";
import { earlierBoardCue, type BoardCardRecord } from "./format";
import type { JobListQuery, JobListRecord } from "./list-params";
import {
  JobAnalysis,
  type JobAnalysis as JobAnalysisData,
  type Requirement,
} from "./schemas";

export type JobPageData = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  status: JobStatus;
  priority: number | null;
  archived: boolean;
  deadline: string | null;
  source: JobSource | null;
  sourceDetail: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: PayPeriod | null;
  referenceNumber: string | null;
  notes: string | null;
  rawText: string;
  analysisStatus: "PENDING" | "READY" | "FAILED";
  retryable: boolean;
  summary: string;
  seniority: JobAnalysisData["seniority"] | null;
  requirements: Requirement[];
  keywords: string[];
};

export type JobListResult = {
  jobs: JobListRecord[];
  total: number;
  timeZone: string;
};

/** Jobs for the list, scoped to this user. `total` counts archived jobs too. */
export async function listJobs(
  userId: string,
  query: JobListQuery,
): Promise<JobListResult> {
  const [owner, total, rows] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }),
    db.job.count({ where: { userId } }),
    db.job.findMany({
      where: jobListWhere(userId, query),
      select: {
        id: true,
        title: true,
        company: true,
        status: true,
        priority: true,
        archivedAt: true,
        appliedAt: true,
        updatedAt: true,
        deadline: true,
        tailoredResumes: {
          where: { status: "READY", matchScore: { not: null } },
          orderBy: { matchScore: "desc" },
          take: 1,
          select: { matchScore: true },
        },
      },
    }),
  ]);

  return {
    timeZone: owner?.timezone ?? "America/Toronto",
    total,
    jobs: rows.map((row) => ({
      id: row.id,
      company: row.company,
      title: row.title,
      status: row.status,
      priority: row.priority,
      matchScore: row.tailoredResumes[0]?.matchScore ?? null,
      appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
      deadline: row.deadline ? formatDeadlineDate(row.deadline) : null,
      archived: row.archivedAt !== null,
    })),
  };
}

export type BoardListResult = {
  cards: BoardCardRecord[];
  total: number;
  timeZone: string;
};

/** Board cards for this user, in column order. `total` counts archived jobs too. */
export async function listBoardJobs(
  userId: string,
  query: JobListQuery,
): Promise<BoardListResult> {
  const now = new Date();
  const [owner, total, rows] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }),
    db.job.count({ where: { userId } }),
    db.job.findMany({
      where: jobListWhere(userId, query),
      orderBy: [{ boardOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        company: true,
        status: true,
        priority: true,
        archivedAt: true,
        deadline: true,
        boardOrder: true,
        submittedResumeId: true,
        tailoredResumes: {
          where: { status: "READY", matchScore: { not: null } },
          orderBy: { matchScore: "desc" },
          take: 1,
          select: { matchScore: true },
        },
        reminders: {
          where: { completedAt: null, dismissedAt: null },
          orderBy: { dueAt: "asc" },
          take: 1,
          select: { dueAt: true },
        },
        interviews: {
          where: { scheduledAt: { gte: now } },
          orderBy: { scheduledAt: "asc" },
          take: 1,
          select: { scheduledAt: true },
        },
      },
    }),
  ]);

  return {
    timeZone: owner?.timezone ?? "America/Toronto",
    total,
    cards: rows.map((row) => {
      const cue = earlierBoardCue(
        row.reminders[0]?.dueAt.toISOString() ?? null,
        row.interviews[0]?.scheduledAt?.toISOString() ?? null,
      );
      return {
        id: row.id,
        company: row.company,
        title: row.title,
        status: row.status,
        priority: row.priority,
        matchScore: row.tailoredResumes[0]?.matchScore ?? null,
        submitted: row.submittedResumeId !== null,
        deadline: row.deadline ? formatDeadlineDate(row.deadline) : null,
        archived: row.archivedAt !== null,
        boardOrder: row.boardOrder,
        nextKind: cue?.kind ?? null,
        nextAt: cue?.at ?? null,
      };
    }),
  };
}

function jobListWhere(userId: string, query: JobListQuery) {
  return {
    userId,
    ...(query.showArchived ? {} : { archivedAt: null }),
    ...(query.source ? { source: query.source } : {}),
    ...(query.workMode ? { workMode: query.workMode } : {}),
    ...(query.minPriority !== null ? { priority: { gte: query.minPriority } } : {}),
    ...(query.hasDeadline ? { deadline: { not: null } } : {}),
    ...(query.q.length > 0
      ? {
          OR: [
            { company: { contains: query.q, mode: "insensitive" as const } },
            { title: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

/** Analyses still available today for this user. */
export async function analysesRemaining(
  userId: string,
  plan: Plan,
): Promise<number> {
  const quota = await quotaSnapshot({ id: userId, plan }, "ANALYZE");
  return quota.remaining;
}

/** One owned job, with analysis JSON parsed. Missing or not owned → null. */
export async function getJob(
  userId: string,
  jobId: string,
): Promise<JobPageData | null> {
  const row = await db.job.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      url: true,
      status: true,
      priority: true,
      archivedAt: true,
      deadline: true,
      source: true,
      sourceDetail: true,
      workMode: true,
      employmentType: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      salaryPeriod: true,
      referenceNumber: true,
      notes: true,
      rawText: true,
      analysis: true,
      analysisStatus: true,
      updatedAt: true,
    },
  });
  if (!row) return null;

  const now = new Date();
  const analysisStatus = displayedAnalysisStatus(
    row.analysisStatus,
    row.updatedAt,
    now,
  );
  const analysis =
    analysisStatus === "READY" ? readAnalysis(row.analysis) : null;

  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    status: row.status,
    priority: row.priority,
    archived: row.archivedAt !== null,
    deadline: row.deadline ? formatDeadlineDate(row.deadline) : null,
    source: row.source,
    sourceDetail: row.sourceDetail,
    workMode: row.workMode,
    employmentType: row.employmentType,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod,
    referenceNumber: row.referenceNumber,
    notes: row.notes,
    rawText: row.rawText,
    analysisStatus,
    retryable: canRetryAnalysis(row.analysisStatus, row.updatedAt, now),
    summary: analysis?.summary ?? "",
    seniority: analysis?.seniority ?? null,
    requirements: analysis?.requirements ?? [],
    keywords: analysis?.keywords ?? [],
  };
}

function readAnalysis(value: unknown): JobAnalysisData {
  const parsed = JobAnalysis.safeParse(value);
  if (!parsed.success) {
    throw new Error("Job analysis JSON did not match the schema.");
  }
  return parsed.data;
}
