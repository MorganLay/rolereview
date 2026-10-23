import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { strings } from "@/copy/strings";

import { ResumeEditor } from "@/features/tailor/components/resume-editor";
import { getResumeWorkspace } from "@/features/tailor/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: strings.pages.resumeWorkspace.title,
  description: strings.pages.resumeWorkspace.body,
};

/** The resume comes from the signed-in user. */
export const instant = false;

export default async function ResumeWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string; resumeId: string }>;
}) {
  const { jobId, resumeId } = await params;
  const user = await requireUser();
  const workspace = await getResumeWorkspace(user.id, user.plan, jobId, resumeId);
  if (!workspace) notFound();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <ResumeEditor workspace={workspace} />
    </div>
  );
}
