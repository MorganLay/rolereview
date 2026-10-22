import { notFound } from "next/navigation";

import { LetterEditor } from "@/features/letters/components/letter-editor";
import { getLetterWorkspace } from "@/features/letters/queries";
import { requireUser } from "@/lib/auth";

/** The letter comes from the signed-in user. */
export const instant = false;

export default async function LetterWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string; letterId: string }>;
}) {
  const { jobId, letterId } = await params;
  const user = await requireUser();
  const workspace = await getLetterWorkspace(user.id, user.plan, jobId, letterId);
  if (!workspace) notFound();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <LetterEditor workspace={workspace} />
    </div>
  );
}
