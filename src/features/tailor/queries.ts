import "server-only";

import { can } from "@/features/billing/entitlements";
import { quotaSnapshot } from "@/features/billing/quota";
import { formatJobInstant } from "@/features/jobs/format";
import { JobAnalysis } from "@/features/jobs/schemas";
import { ENTRY_KINDS, LibrarySnapshot } from "@/features/library/schemas";
import type { Plan } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { resolveResumeTemplate } from "@/lib/pdf/template";

import type { LibraryEntryOption, ResumeWorkspaceData } from "./content";
import { MatchReport, ResumeContent } from "./schemas";
import {
  displayedTailorStatus,
  type JobDocuments,
} from "./status";
import { versionIsFrozen, versionTitle } from "./version";

export type { JobDocuments };

/** Version cards and whether this library can be tailored. Scoped to the user. */
export async function getJobDocuments(
  userId: string,
  plan: Plan,
  jobId: string,
): Promise<JobDocuments> {
  const [entries, skills, quota, row] = await Promise.all([
    db.entry.count({ where: { userId } }),
    db.skill.count({ where: { userId } }),
    quotaSnapshot({ id: userId, plan }, "TAILOR"),
    db.job.findFirst({
      where: { id: jobId, userId },
      select: {
        company: true,
        user: { select: { timezone: true } },
        tailoredResumes: {
          orderBy: { version: "desc" },
          select: {
            id: true,
            version: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            matchScore: true,
            templateId: true,
            rating: true,
            label: true,
            submittedAt: true,
          },
        },
      },
    }),
  ]);

  const now = new Date();
  const timeZone = row?.user.timezone || "America/Toronto";
  const versions = (row?.tailoredResumes ?? []).map((resume) => ({
    id: resume.id,
    version: resume.version,
    status: displayedTailorStatus(resume.status, resume.updatedAt, now),
    createdLabel: formatJobInstant(resume.createdAt.toISOString(), timeZone),
    matchScore: resume.matchScore,
    templateId: resume.templateId,
    rating: ratingValue(resume.rating),
    submitted: versionIsFrozen(resume.submittedAt),
    title: versionTitle({
      label: resume.label,
      company: row?.company ?? "",
      createdAt: resume.createdAt,
      timeZone,
    }),
  }));

  return {
    canTailor: entries + skills > 0,
    tailorsLeft: quota.remaining,
    pending: versions.some((version) => version.status === "PENDING"),
    versions,
  };
}

function ratingValue(value: number | null): 1 | -1 | null {
  if (value === 1 || value === -1) return value;
  return null;
}

/** A READY resume the user can edit. Missing, pending, or failed → null. */
export async function getResumeWorkspace(
  userId: string,
  plan: Plan,
  jobId: string,
  resumeId: string,
): Promise<ResumeWorkspaceData | null> {
  const [row, entries] = await Promise.all([
    db.tailoredResume.findFirst({
      where: { id: resumeId, jobId, userId },
      select: {
        id: true,
        version: true,
        status: true,
        updatedAt: true,
        templateId: true,
        label: true,
        submittedAt: true,
        createdAt: true,
        content: true,
        librarySnapshot: true,
        matchReport: true,
        job: {
          select: {
            title: true,
            company: true,
            analysis: true,
            status: true,
            submittedResumeId: true,
          },
        },
        user: { select: { timezone: true } },
      },
    }),
    db.entry.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        organization: true,
        kind: true,
        sortOrder: true,
      },
    }),
  ]);
  if (!row || row.status !== "READY") return null;

  const content = ResumeContent.safeParse(row.content);
  const snapshot = LibrarySnapshot.safeParse(row.librarySnapshot);
  if (!content.success || !snapshot.success) return null;

  const report = MatchReport.safeParse(row.matchReport);
  const analysis = JobAnalysis.safeParse(row.job.analysis);

  return {
    jobId,
    jobTitle: row.job.title,
    company: row.job.company,
    resumeId: row.id,
    version: row.version,
    savedAt: row.updatedAt.toISOString(),
    timeZone: row.user.timezone || "America/Toronto",
    content: content.data,
    snapshot: snapshot.data,
    match: report.success ? report.data : { verdicts: [], score: null },
    requirements: analysis.success ? analysis.data.requirements : [],
    keywords: analysis.success ? analysis.data.keywords : [],
    libraryEntries: sortLibraryEntries(entries),
    templateId: resolveResumeTemplate(null, row.templateId, {
      modern: true,
      compact: true,
    }),
    submitted: row.id === row.job.submittedResumeId,
    label: row.label,
    title: versionTitle({
      label: row.label,
      company: row.job.company,
      createdAt: row.createdAt,
      timeZone: row.user.timezone || "America/Toronto",
    }),
    frozen: versionIsFrozen(row.submittedAt),
    submittedOn: row.submittedAt
      ? formatJobInstant(row.submittedAt.toISOString(), row.user.timezone || "America/Toronto")
      : null,
    jobStatus: row.job.status,
    templates: {
      modern: can({ plan }, "template:modern"),
      compact: can({ plan }, "template:compact"),
      docx: can({ plan }, "docx"),
    },
  };
}

/** Same order as the library page: section, then sort order. */
function sortLibraryEntries(
  entries: (LibraryEntryOption & { sortOrder: number })[],
): LibraryEntryOption[] {
  return [...entries]
    .sort((a, b) => {
      const kindDelta = ENTRY_KINDS.indexOf(a.kind) - ENTRY_KINDS.indexOf(b.kind);
      if (kindDelta !== 0) return kindDelta;
      return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
    })
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      organization: entry.organization,
      kind: entry.kind,
    }));
}
