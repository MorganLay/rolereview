"use server";

import { revalidatePath } from "next/cache";

import { strings } from "@/copy/strings";
import { can } from "@/features/billing/entitlements";
import { checkQuota } from "@/features/billing/quota";
import { getLibrary } from "@/features/library/queries";
import { LibrarySnapshot, zodFieldErrors } from "@/features/library/schemas";
import { serializeLibrary } from "@/features/library/serialize";
import type { Library } from "@/features/library/types";
import { JobAnalysis } from "@/features/jobs/schemas";
import { ResumeContent } from "@/features/tailor/schemas";
import { Prisma } from "@/generated/prisma/client";
import { buildContent, OutputSchema, SYSTEM } from "@/lib/ai/prompts/letter";
import { POSTING_MAX } from "@/lib/ai/prompts/tailor";
import { runStructured } from "@/lib/ai/run";
import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { assembleLetterContent } from "./assemble";
import { applyLetterEdit } from "./content";
import { focusRefsForLibrary, includedBulletRefs } from "./focus";
import {
  CoverLetterContent,
  CoverLetterOptions,
  ValidatedLetterOutput,
  markLetterSubmittedSchema,
  rateLetterSchema,
  saveLetterContentSchema,
  setLetterTemplateSchema,
  writeLetterSchema,
} from "./schemas";
import { LETTER_STALE_MS } from "./status";
import { validateLetterOutput } from "./validate";

const copy = strings.jobs.letters;

export type WriteLetterResult = {
  letterId: string;
};

/** Write a cover letter for one job. docs/03-ARCHITECTURE.md → Data flow: tailor. */
export async function writeCoverLetter(
  input: unknown,
): Promise<ActionResult<WriteLetterResult>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = writeLetterSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const job = await db.job.findFirst({
    where: { id: parsed.data.jobId, userId: user.id },
    select: {
      id: true,
      title: true,
      company: true,
      rawText: true,
      analysisStatus: true,
      analysis: true,
    },
  });
  if (!job) return fail("NOT_FOUND");

  const analysis =
    job.analysisStatus === "READY" ? JobAnalysis.safeParse(job.analysis) : null;
  if (!analysis?.success) {
    return fail("VALIDATION", { job: [copy.disabledAnalysis] });
  }

  const library = await getLibrary(user.id);
  if (!library) return fail("NOT_FOUND");
  if (!libraryHasMaterial(library)) {
    return fail("VALIDATION", { library: [copy.disabledLibrary] });
  }

  const now = new Date();
  const serialized = serializeLibrary(library, now.toISOString());
  const aligned = await resumeFocusFor(
    user.id,
    job.id,
    parsed.data.resumeId,
    serialized.snapshot,
  );
  if (!aligned.ok) return fail("VALIDATION", { resumeId: [copy.alignMissing] });

  const quota = await checkQuota(user, "COVER_LETTER");
  if (!quota.allowed) return fail("QUOTA_EXCEEDED");

  const recipientName = filled(parsed.data.recipientName);
  const whyCompany = filled(parsed.data.whyCompany);
  const options = CoverLetterOptions.parse({
    tone: parsed.data.tone,
    length: parsed.data.length,
    ...(recipientName ? { recipientName } : {}),
    ...(whyCompany ? { whyCompany } : {}),
    ...(parsed.data.resumeId ? { resumeId: parsed.data.resumeId } : {}),
  });

  let letterId: string;
  try {
    const claimed = await claimVersion({
      userId: user.id,
      jobId: job.id,
      now,
      options,
      snapshot: serialized.snapshot,
    });
    if (claimed === "conflict") return fail("CONFLICT");
    letterId = claimed.id;
  } catch {
    return fail("INTERNAL");
  }

  const posting = job.rawText.slice(0, POSTING_MAX);

  try {
    const result = await runStructured({
      kind: "COVER_LETTER",
      userId: user.id,
      usedBonusCredit: quota.useBonus,
      system: SYSTEM,
      content: buildContent({
        libraryText: serialized.text,
        title: job.title,
        company: job.company,
        requirements: analysis.data.requirements,
        keywords: analysis.data.keywords,
        posting,
        whyCompany: whyCompany ?? null,
        tone: options.tone,
        length: options.length,
        recipientName: recipientName ?? null,
        candidateName: serialized.snapshot.profile.fullName,
        resumeFocus: aligned.focus,
      }),
      schema: OutputSchema,
      refId: letterId,
    });
    if (!result.ok) {
      await markFailed(user.id, letterId, result.code);
      revalidateJob(job.id);
      return fail("AI_FAILED");
    }

    const guard = validateLetterOutput(result.data, {
      snapshot: serialized.snapshot,
      posting,
      whyCompany: whyCompany ?? null,
      requirementIds: analysis.data.requirements.map((item) => item.id),
    });
    logGuard(user.id, letterId, guard.reverts, guard.issues);
    const content = assembleLetterContent(
      guard.output,
      serialized.snapshot,
      { recipientName: recipientName ?? null },
    );
    const saved = await db.$transaction(async (tx) => {
      const updated = await tx.coverLetter.updateMany({
        where: { id: letterId, userId: user.id, status: "PENDING" },
        data: {
          status: "READY",
          aiOutput: toJson(guard.output),
          content: toJson(content),
          guardReverts: guard.reverts,
          error: null,
        },
      });
      if (updated.count === 0) return false;
      await tx.jobEvent.create({
        data: {
          userId: user.id,
          jobId: job.id,
          type: "LETTER_WRITTEN",
        },
      });
      return true;
    });
    if (!saved) return fail("NOT_FOUND");
    revalidateJob(job.id);
    return ok({ letterId });
  } catch {
    try {
      await markFailed(user.id, letterId, "INTERNAL");
    } catch {
      return fail("INTERNAL");
    }
    revalidateJob(job.id);
    return fail("AI_FAILED");
  }
}

/** Set helpful or not helpful. The same choice again clears it. */
export async function rateCoverLetter(
  input: unknown,
): Promise<ActionResult<{ rating: 1 | -1 | null }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = rateLetterSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const existing = await db.coverLetter.findFirst({
    where: { id: parsed.data.letterId, userId: user.id, status: "READY" },
    select: { id: true, jobId: true, rating: true },
  });
  if (!existing) return fail("NOT_FOUND");

  const rating = existing.rating === parsed.data.rating ? null : parsed.data.rating;
  const updated = await db.coverLetter.updateMany({
    where: { id: existing.id, userId: user.id },
    data: { rating, ratingReason: null },
  });
  if (updated.count === 0) return fail("NOT_FOUND");
  revalidateLetter(existing.jobId, existing.id);
  return ok({ rating });
}

/** Save the PDF template. Modern and Compact require Pro. */
export async function setLetterTemplate(
  input: unknown,
): Promise<ActionResult<{ templateId: "classic" | "modern" | "compact" }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = setLetterTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const feature =
    parsed.data.templateId === "modern"
      ? "template:modern"
      : parsed.data.templateId === "compact"
        ? "template:compact"
        : null;
  if (feature && !can(user, feature)) return fail("PRO_REQUIRED");

  const updated = await db.coverLetter.updateMany({
    where: {
      id: parsed.data.letterId,
      jobId: parsed.data.jobId,
      userId: user.id,
      status: "READY",
    },
    data: { templateId: parsed.data.templateId },
  });
  if (updated.count === 0) return fail("NOT_FOUND");

  revalidateLetter(parsed.data.jobId, parsed.data.letterId);
  return ok({ templateId: parsed.data.templateId });
}

/** Point the job at this letter. Does not change status. */
export async function markLetterSubmitted(
  input: unknown,
): Promise<ActionResult<{ submitted: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = markLetterSubmittedSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const letter = await db.coverLetter.findFirst({
    where: {
      id: parsed.data.letterId,
      jobId: parsed.data.jobId,
      userId: user.id,
      status: "READY",
    },
    select: { id: true },
  });
  if (!letter) return fail("NOT_FOUND");

  const job = await db.job.findFirst({
    where: { id: parsed.data.jobId, userId: user.id },
    select: { id: true },
  });
  if (!job) return fail("NOT_FOUND");

  const updated = await db.job.updateMany({
    where: { id: job.id, userId: user.id },
    data: { submittedCoverLetterId: letter.id },
  });
  if (updated.count === 0) return fail("NOT_FOUND");

  revalidateLetter(job.id, letter.id);
  return ok({ submitted: true });
}

export type SaveLetterContentResult = {
  content: CoverLetterContent;
  savedAt: string;
};

/** Autosave the workspace. Source refs stay as stored. */
export async function saveLetterContent(
  input: unknown,
): Promise<ActionResult<SaveLetterContentResult>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = saveLetterContentSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const existing = await db.coverLetter.findFirst({
    where: {
      id: parsed.data.letterId,
      jobId: parsed.data.jobId,
      userId: user.id,
      status: "READY",
    },
    select: { id: true, content: true, aiOutput: true },
  });
  if (!existing) return fail("NOT_FOUND");

  const stored = CoverLetterContent.safeParse(existing.content);
  if (!stored.success) return fail("NOT_FOUND");

  const aiParsed = ValidatedLetterOutput.safeParse(existing.aiOutput);
  const edited = applyLetterEdit({
    stored: stored.data,
    incoming: parsed.data.content,
    aiOutput: aiParsed.success ? aiParsed.data : null,
  });
  if (!edited.ok) {
    console.info(
      JSON.stringify({
        event: "letter.save.rejected",
        userId: user.id,
        letterId: existing.id,
        issue: edited.issue,
      }),
    );
    return fail("VALIDATION");
  }

  const updated = await db.coverLetter.updateMany({
    where: {
      id: existing.id,
      jobId: parsed.data.jobId,
      userId: user.id,
      status: "READY",
    },
    data: { content: toJson(edited.content) },
  });
  if (updated.count === 0) return fail("NOT_FOUND");

  const saved = await db.coverLetter.findFirst({
    where: { id: existing.id, userId: user.id },
    select: { updatedAt: true },
  });
  revalidateLetter(parsed.data.jobId, existing.id);
  return ok({
    content: edited.content,
    savedAt: saved?.updatedAt.toISOString() ?? new Date().toISOString(),
  });
}


function libraryHasMaterial(library: Library): boolean {
  return library.entries.length > 0 || library.skills.length > 0;
}

function filled(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value;
}

async function resumeFocusFor(
  userId: string,
  jobId: string,
  resumeId: string | undefined,
  current: LibrarySnapshot,
): Promise<{ ok: true; focus: string[] | null } | { ok: false }> {
  if (!resumeId) return { ok: true, focus: null };

  const resume = await db.tailoredResume.findFirst({
    where: { id: resumeId, jobId, userId, status: "READY" },
    select: { content: true, librarySnapshot: true },
  });
  if (!resume) return { ok: false };

  const content = ResumeContent.safeParse(resume.content);
  const snapshot = LibrarySnapshot.safeParse(resume.librarySnapshot);
  if (!content.success || !snapshot.success) return { ok: false };

  const refs = focusRefsForLibrary(
    includedBulletRefs(content.data),
    snapshot.data,
    current,
  );
  return { ok: true, focus: refs.length > 0 ? refs : null };
}

async function claimVersion(input: {
  userId: string;
  jobId: string;
  now: Date;
  options: CoverLetterOptions;
  snapshot: LibrarySnapshot;
}): Promise<{ id: string } | "conflict"> {
  try {
    const claimed = await db.$transaction(async (tx) => {
      const pending = await tx.coverLetter.findFirst({
        where: {
          userId: input.userId,
          jobId: input.jobId,
          status: "PENDING",
          updatedAt: { gt: new Date(input.now.getTime() - LETTER_STALE_MS) },
        },
        select: { id: true },
      });
      if (pending) return null;

      const latest = await tx.coverLetter.findFirst({
        where: { userId: input.userId, jobId: input.jobId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      return tx.coverLetter.create({
        data: {
          userId: input.userId,
          jobId: input.jobId,
          version: (latest?.version ?? 0) + 1,
          status: "PENDING",
          options: toJson(input.options),
          librarySnapshot: toJson(input.snapshot),
          templateId: "classic",
        },
        select: { id: true },
      });
    });
    return claimed ?? "conflict";
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "conflict";
    }
    throw error;
  }
}

async function markFailed(
  userId: string,
  letterId: string,
  error: string,
): Promise<void> {
  await db.coverLetter.updateMany({
    where: { id: letterId, userId, status: "PENDING" },
    data: { status: "FAILED", error },
  });
}

function logGuard(
  userId: string,
  letterId: string,
  reverts: number,
  issues: { code: string; ref: string }[],
): void {
  if (issues.length === 0) return;
  console.info(
    JSON.stringify({
      event: "letter.guard",
      userId,
      letterId,
      reverts,
      issues: issues.map((issue) => ({ code: issue.code, ref: issue.ref })),
    }),
  );
}

function revalidateJob(jobId: string): void {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

function revalidateLetter(jobId: string, letterId: string): void {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/letters/${letterId}`);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
