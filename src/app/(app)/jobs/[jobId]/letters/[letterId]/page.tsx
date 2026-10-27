import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { strings } from "@/copy/strings";

import { LetterEditor } from "@/features/letters/components/letter-editor";
import { getLetterWorkspace } from "@/features/letters/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: strings.pages.letterWorkspace.title,
  description: strings.pages.letterWorkspace.body,
};

/** The letter comes from the signed-in user. */
export const instant = false;

export default async function LetterWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string; letterId: string }>;
}) {
  await connection();
  const { jobId, letterId } = await params;
  const user = await requireUser();
  const workspace = await getLetterWorkspace(user.id, user.plan, jobId, letterId);
  if (!workspace) notFound();

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
      <LetterEditor workspace={workspace} />
    </div>
  );
}
