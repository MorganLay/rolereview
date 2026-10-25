import { notFound } from "next/navigation";
import { z } from "zod";

import { can } from "@/features/billing/entitlements";
import { CoverLetterContent } from "@/features/letters/schemas";
import { LibrarySnapshot } from "@/features/library/schemas";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contentDisposition, letterPdfFilename } from "@/lib/pdf/filename";
import { letterPdfModel } from "@/lib/pdf/letter-model";
import { renderLetterPdf } from "@/lib/pdf/render";
import { resolveResumeTemplate, storedResumeTemplate } from "@/lib/pdf/template";

/** Saved cover letter PDF. Unentitled Modern or Compact renders as Classic. */
export async function GET(
  request: Request,
  context: { params: Promise<{ letterId: string }> },
) {
  const user = await requireUser();
  const { letterId } = await context.params;
  if (!z.uuid().safeParse(letterId).success) notFound();

  const row = await db.coverLetter.findFirst({
    where: { id: letterId, userId: user.id },
    select: {
      status: true,
      templateId: true,
      submittedAt: true,
      content: true,
      librarySnapshot: true,
      job: { select: { title: true, company: true } },
    },
  });
  if (!row || row.status !== "READY") notFound();

  const content = CoverLetterContent.safeParse(row.content);
  const snapshot = LibrarySnapshot.safeParse(row.librarySnapshot);
  if (!content.success || !snapshot.success) notFound();

  const template = row.submittedAt
    ? storedResumeTemplate(row.templateId)
    : resolveResumeTemplate(
        new URL(request.url).searchParams.get("template"),
        row.templateId,
        {
          modern: can(user, "template:modern"),
          compact: can(user, "template:compact"),
        },
      );
  const pdf = await renderLetterPdf(
    letterPdfModel(content.data),
    template,
    row.submittedAt ?? undefined,
  );
  const filename = letterPdfFilename(
    snapshot.data.profile.fullName,
    row.job.company,
    row.job.title,
  );

  await db.coverLetter.updateMany({
    where: { id: letterId, userId: user.id },
    data: { exportedAt: new Date() },
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(filename),
      "Cache-Control": "private, no-store",
    },
  });
}
