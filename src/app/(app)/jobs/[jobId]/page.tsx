import { notFound } from "next/navigation";

import { JobResult } from "@/features/jobs/components/job-result";
import type { JobSectionTab } from "@/features/jobs/components/job-sections";
import { analysesRemaining, getJob } from "@/features/jobs/queries";
import { getJobDocuments } from "@/features/tailor/queries";
import { listJobInterviews, listJobTimeline } from "@/features/tracking/queries";
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
  const [job, analysesLeft, documents, timeline, interviews] = await Promise.all([
    getJob(user.id, jobId),
    analysesRemaining(user.id, user.plan),
    getJobDocuments(user.id, user.plan, jobId),
    listJobTimeline(user.id, jobId),
    listJobInterviews(user.id, jobId),
  ]);
  if (!job) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <JobResult
        job={job}
        analysesLeft={analysesLeft}
        documents={documents}
        initialTab={jobTab(query.tab, documents.pending)}
        timeline={timeline.events}
        hideAuto={queryValue(query.events) === "manual"}
        today={timeline.today}
        interviews={interviews.interviews}
        interviewTimeZone={interviews.timeZone}
        interviewNow={interviews.now}
        nextRound={interviews.nextRound}
      />
    </div>
  );
}

function jobTab(
  value: string | string[] | undefined,
  pending: boolean,
): JobSectionTab {
  const tab = queryValue(value);
  if (
    tab === "documents" ||
    tab === "timeline" ||
    tab === "overview" ||
    tab === "interviews"
  ) {
    return tab;
  }
  return pending ? "documents" : "overview";
}

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
