import { notFound } from "next/navigation";

import { JobResult } from "@/features/jobs/components/job-result";
import { analysesRemaining, getJob } from "@/features/jobs/queries";
import { getJobDocuments } from "@/features/tailor/queries";
import { requireUser } from "@/lib/auth";

/** Analysis retry and tailoring call the model and can take up to a minute. */
export const maxDuration = 120;

/** The job comes from the signed-in user. */
export const instant = false;

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { jobId } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const [job, analysesLeft, documents] = await Promise.all([
    getJob(user.id, jobId),
    analysesRemaining(user.id, user.plan),
    getJobDocuments(user.id, user.plan, jobId),
  ]);
  if (!job) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <JobResult
        job={job}
        analysesLeft={analysesLeft}
        documents={documents}
        initialTab={jobTab(query.tab, documents.pending)}
      />
    </div>
  );
}

function jobTab(
  value: string | string[] | undefined,
  pending: boolean,
): "overview" | "documents" {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "documents") return "documents";
  if (tab === "overview") return "overview";
  return pending ? "documents" : "overview";
}
