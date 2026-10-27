import { notFound } from "next/navigation";
import { z } from "zod";

import { can } from "@/features/billing/entitlements";
import { LibrarySnapshot } from "@/features/library/schemas";
import { FIRST_EXPORT_HEADER } from "@/features/tailor/export-prompt";
import { MatchReport, ResumeContent, TailorOptions } from "@/features/tailor/schemas";
import { requireUser } from "@/lib/auth";
import { captureServerEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { encodeFitSuggestions } from "@/lib/pdf/fit-header";
import { contentDisposition, resumePdfFilename } from "@/lib/pdf/filename";
import { resumePdfModel } from "@/lib/pdf/model";
import { fitResumePdf } from "@/lib/pdf/render";
import { suggestBulletsToTurnOff } from "@/lib/pdf/suggest";
import { resolveResumeTemplate, storedResumeTemplate } from "@/lib/pdf/template";

/** Saved resume PDF. Unentitled Modern or Compact renders as Classic. */
export async function GET(
  request: Request,
  context: { params: Promise<{ resumeId: string }> },
) {
  const user = await requireUser();
  const { resumeId } = await context.params;
  if (!z.uuid().safeParse(resumeId).success) notFound();

  const row = await db.tailoredResume.findFirst({
    where: { id: resumeId, userId: user.id },
    select: {
      status: true,
      templateId: true,
      options: true,
      exportedAt: true,
      submittedAt: true,
      content: true,
      librarySnapshot: true,
      matchReport: true,
      job: { select: { title: true, company: true } },
    },
  });
  if (!row || row.status !== "READY") notFound();

  const content = ResumeContent.safeParse(row.content);
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
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const model = resumePdfModel(content.data, snapshot.data);
  const tailor = TailorOptions.safeParse(row.options ?? {});
  const fit = await fitResumePdf(model, template, {
    pages: tailor.success ? tailor.data.length : 1,
    producedAt: row.submittedAt ?? undefined,
  });
  const filename = resumePdfFilename(
    snapshot.data.profile.fullName,
    row.job.company,
    row.job.title,
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": preview
      ? contentDisposition(filename).replace(/^attachment/, "inline")
      : contentDisposition(filename),
    "Cache-Control": "private, no-store",
    "X-Pdf-Pages": String(fit.pageCount),
  };

  if (!preview) {
    const firstExport = row.exportedAt == null;
    await db.tailoredResume.updateMany({
      where: { id: resumeId, userId: user.id },
      data: { exportedAt: new Date() },
    });
    await captureServerEvent(user.id, "resume_exported", {
      format: "pdf",
      template,
    });
    headers[FIRST_EXPORT_HEADER] = firstExport ? "1" : "0";
  } else if (fit.overByLines > 0) {
    headers["X-Over-Lines"] = String(fit.overByLines);
    const report = MatchReport.safeParse(row.matchReport);
    const suggestions = suggestBulletsToTurnOff(
      content.data,
      report.success ? report.data.verdicts : [],
      snapshot.data.skills,
    );
    if (suggestions.length > 0) {
      headers["X-Fit-Suggestions"] = encodeFitSuggestions(suggestions);
    }
  }

  return new Response(new Uint8Array(fit.pdf), { headers });
}
