import { notFound } from "next/navigation";
import { z } from "zod";

import { can } from "@/features/billing/entitlements";
import { LibrarySnapshot } from "@/features/library/schemas";
import { FIRST_EXPORT_HEADER } from "@/features/tailor/export-prompt";
import { ResumeContent } from "@/features/tailor/schemas";
import { captureServerEvent } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOCX_MIME } from "@/lib/docx/file";
import { renderResumeDocx } from "@/lib/docx/resume";
import { contentDisposition, resumeDocxFilename } from "@/lib/pdf/filename";
import { resumePdfModel } from "@/lib/pdf/model";
import { resolveResumeTemplate } from "@/lib/pdf/template";
import { fail } from "@/lib/result";

/** Saved resume DOCX. Pro only. Same section order as the PDF. */
export async function GET(
  request: Request,
  context: { params: Promise<{ resumeId: string }> },
) {
  const user = await requireUser();
  if (!can(user, "docx")) {
    return Response.json(fail("PRO_REQUIRED"), { status: 403 });
  }

  const { resumeId } = await context.params;
  if (!z.uuid().safeParse(resumeId).success) notFound();

  const row = await db.tailoredResume.findFirst({
    where: { id: resumeId, userId: user.id },
    select: {
      status: true,
      templateId: true,
      exportedAt: true,
      content: true,
      librarySnapshot: true,
      job: { select: { title: true, company: true } },
    },
  });
  if (!row || row.status !== "READY") notFound();

  const content = ResumeContent.safeParse(row.content);
  const snapshot = LibrarySnapshot.safeParse(row.librarySnapshot);
  if (!content.success || !snapshot.success) notFound();

  const template = resolveResumeTemplate(
    new URL(request.url).searchParams.get("template"),
    row.templateId,
    {
      modern: can(user, "template:modern"),
      compact: can(user, "template:compact"),
    },
  );
  const buffer = await renderResumeDocx(resumePdfModel(content.data, snapshot.data));
  const filename = resumeDocxFilename(
    snapshot.data.profile.fullName,
    row.job.company,
    row.job.title,
  );

  const firstExport = row.exportedAt == null;
  await db.tailoredResume.updateMany({
    where: { id: resumeId, userId: user.id },
    data: { exportedAt: new Date() },
  });
  await captureServerEvent(user.id, "resume_exported", {
    format: "docx",
    template,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": contentDisposition(filename),
      "Cache-Control": "private, no-store",
      [FIRST_EXPORT_HEADER]: firstExport ? "1" : "0",
    },
  });
}
