import "server-only";

import { can } from "@/features/billing/entitlements";
import { quotaSnapshot } from "@/features/billing/quota";
import { formatJobInstant } from "@/features/jobs/format";
import { JobAnalysis } from "@/features/jobs/schemas";
import { LibrarySnapshot } from "@/features/library/schemas";
import type { Plan } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { resolveResumeTemplate } from "@/lib/pdf/template";

import type { LetterWorkspaceData } from "./content";
import {
  CoverLetterContent,
  CoverLetterOptions,
  type LetterLength,
  type LetterTone,
} from "./schemas";
import { displayedLetterStatus, type JobLetters } from "./status";

export type { JobLetters };

/** Letter versions and READY resumes this job can align with. */
export async function getJobLetters(
  userId: string,
  plan: Plan,
  jobId: string,
): Promise<JobLetters> {
  const [quota, row] = await Promise.all([
    quotaSnapshot({ id: userId, plan }, "COVER_LETTER"),
    db.job.findFirst({
      where: { id: jobId, userId },
      select: {
        submittedCoverLetterId: true,
        user: { select: { timezone: true } },
        coverLetters: {
          orderBy: { version: "desc" },
          select: {
            id: true,
            version: true,
            status: true,
            options: true,
            templateId: true,
            rating: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        tailoredResumes: {
          where: { status: "READY" },
          orderBy: { version: "desc" },
          select: { id: true, version: true },
        },
      },
    }),
  ]);

  const now = new Date();
  const timeZone = row?.user.timezone || "America/Toronto";
  const versions = (row?.coverLetters ?? []).map((letter) => {
    const options = letterChoices(letter.options);
    return {
      id: letter.id,
      version: letter.version,
      status: displayedLetterStatus(letter.status, letter.updatedAt, now),
      createdLabel: formatJobInstant(letter.createdAt.toISOString(), timeZone),
      tone: options.tone,
      length: options.length,
      templateId: letter.templateId,
      rating: ratingValue(letter.rating),
      submitted: letter.id === row?.submittedCoverLetterId,
    };
  });

  return {
    lettersLeft: quota.remaining,
    pending: versions.some((version) => version.status === "PENDING"),
    versions,
    resumes: (row?.tailoredResumes ?? []).map((resume) => ({
      id: resume.id,
      version: resume.version,
    })),
  };
}

function letterChoices(value: unknown): { tone: LetterTone; length: LetterLength } {
  const parsed = CoverLetterOptions.safeParse(value ?? {});
  if (!parsed.success) return { tone: "professional", length: "standard" };
  return { tone: parsed.data.tone, length: parsed.data.length };
}

function ratingValue(value: number | null): 1 | -1 | null {
  if (value === 1 || value === -1) return value;
  return null;
}

/** A READY letter the user can edit. Missing, pending, or failed → null. */
export async function getLetterWorkspace(
  userId: string,
  plan: Plan,
  jobId: string,
  letterId: string,
): Promise<LetterWorkspaceData | null> {
  const row = await db.coverLetter.findFirst({
    where: { id: letterId, jobId, userId },
    select: {
      id: true,
      version: true,
      status: true,
      updatedAt: true,
      templateId: true,
      content: true,
      librarySnapshot: true,
      options: true,
      rating: true,
      job: {
        select: {
          title: true,
          company: true,
          analysis: true,
          submittedCoverLetterId: true,
        },
      },
      user: { select: { timezone: true } },
    },
  });
  if (!row || row.status !== "READY") return null;

  const content = CoverLetterContent.safeParse(row.content);
  const snapshot = LibrarySnapshot.safeParse(row.librarySnapshot);
  if (!content.success || !snapshot.success) return null;

  const options = CoverLetterOptions.safeParse(row.options ?? {});
  const analysis = JobAnalysis.safeParse(row.job.analysis);
  const addressed = new Set(content.data.requirementIdsAddressed);
  const requirements = analysis.success
    ? analysis.data.requirements.filter((item) => addressed.has(item.id))
    : [];

  return {
    jobId,
    jobTitle: row.job.title,
    company: row.job.company,
    letterId: row.id,
    version: row.version,
    savedAt: row.updatedAt.toISOString(),
    timeZone: row.user.timezone || "America/Toronto",
    content: content.data,
    snapshot: snapshot.data,
    tone: options.success ? options.data.tone : "professional",
    length: options.success ? options.data.length : "standard",
    requirements,
    templateId: resolveResumeTemplate(null, row.templateId, {
      modern: true,
      compact: true,
    }),
    submitted: row.id === row.job.submittedCoverLetterId,
    rating: ratingValue(row.rating),
    templates: {
      modern: can({ plan }, "template:modern"),
      compact: can({ plan }, "template:compact"),
      docx: can({ plan }, "docx"),
    },
  };
}
