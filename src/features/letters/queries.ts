import "server-only";

import { quotaSnapshot } from "@/features/billing/quota";
import { formatJobInstant } from "@/features/jobs/format";
import type { Plan } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import {
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
