import { notFound } from "next/navigation";
import { z } from "zod";

import { can } from "@/features/billing/entitlements";
import { CoverLetterContent } from "@/features/letters/schemas";
import { LibrarySnapshot } from "@/features/library/schemas";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOCX_MIME } from "@/lib/docx/file";
import { renderLetterDocx } from "@/lib/docx/letter";
import { contentDisposition, letterDocxFilename } from "@/lib/pdf/filename";
import { letterPdfModel } from "@/lib/pdf/letter-model";
import { fail } from "@/lib/result";

/** Saved cover letter DOCX. Pro only. Same order as the PDF. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ letterId: string }> },
) {
  const user = await requireUser();
  if (!can(user, "docx")) {
    return Response.json(fail("PRO_REQUIRED"), { status: 403 });
  }

  const { letterId } = await context.params;
  if (!z.uuid().safeParse(letterId).success) notFound();

  const row = await db.coverLetter.findFirst({
    where: { id: letterId, userId: user.id },
    select: {
      status: true,
      content: true,
      librarySnapshot: true,
      job: { select: { title: true, company: true } },
    },
  });
  if (!row || row.status !== "READY") notFound();

  const content = CoverLetterContent.safeParse(row.content);
  const snapshot = LibrarySnapshot.safeParse(row.librarySnapshot);
  if (!content.success || !snapshot.success) notFound();

  const buffer = await renderLetterDocx(letterPdfModel(content.data));
  const filename = letterDocxFilename(
    snapshot.data.profile.fullName,
    row.job.company,
    row.job.title,
  );

  await db.coverLetter.updateMany({
    where: { id: letterId, userId: user.id },
    data: { exportedAt: new Date() },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": contentDisposition(filename),
      "Cache-Control": "private, no-store",
    },
  });
}
