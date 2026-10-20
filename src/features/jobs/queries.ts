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
