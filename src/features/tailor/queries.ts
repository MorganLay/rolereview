import "server-only";

import { quotaSnapshot } from "@/features/billing/quota";
import { formatJobInstant } from "@/features/jobs/format";
import type { Plan } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import {
  displayedTailorStatus,
  type JobDocuments,
} from "./status";

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
        submittedResumeId: true,
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
    submitted: resume.id === row?.submittedResumeId,
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
