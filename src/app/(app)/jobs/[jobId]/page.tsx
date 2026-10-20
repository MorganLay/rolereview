import { notFound } from "next/navigation";

import { JobResult } from "@/features/jobs/components/job-result";
import { analysesRemaining, getJob } from "@/features/jobs/queries";
import { requireUser } from "@/lib/auth";

/** Retry calls the model and can take several seconds. */
export const maxDuration = 120;

/** The job comes from the signed-in user. */
export const instant = false;

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const user = await requireUser();
  const job = await getJob(user.id, jobId);
  if (!job) notFound();
  const analysesLeft = await analysesRemaining(user.id, user.plan);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <JobResult job={job} analysesLeft={analysesLeft} />
    </div>
  );
}
