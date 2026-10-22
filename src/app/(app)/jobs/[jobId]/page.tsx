import { notFound } from "next/navigation";

import { JobResult } from "@/features/jobs/components/job-result";
import type { JobSectionTab } from "@/features/jobs/components/job-sections";
import { analysesRemaining, getJob } from "@/features/jobs/queries";
import { getJobLetters } from "@/features/letters/queries";
import { getJobDocuments } from "@/features/tailor/queries";
import { offerTabVisible } from "@/features/tracking/offers";
import {
  getJobOffer,
  listJobContacts,
  listJobInterviews,
  listJobReminders,
  listJobTimeline,
} from "@/features/tracking/queries";
import { requireUser } from "@/lib/auth";

/** Analysis retry, tailoring, and cover letters call the model and can take up to a minute. */
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
  const [job, analysesLeft, documents, letters, timeline, interviews, contacts, reminders, offer] =
    await Promise.all([
      getJob(user.id, jobId),
      analysesRemaining(user.id, user.plan),
      getJobDocuments(user.id, user.plan, jobId),
      getJobLetters(user.id, user.plan, jobId),
      listJobTimeline(user.id, jobId),
      listJobInterviews(user.id, jobId),
      listJobContacts(user.id, jobId),
      listJobReminders(user.id, jobId),
      getJobOffer(user.id, jobId),
    ]);
  if (!job) notFound();
  const initialTab = jobTab(query.tab, documents.pending || letters.pending);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <JobResult
        job={job}
        analysesLeft={analysesLeft}
        documents={documents}
        letters={letters}
        initialTab={initialTab}
        timeline={timeline.events}
        hideAuto={queryValue(query.events) === "manual"}
        today={timeline.today}
        interviews={interviews.interviews}
        interviewTimeZone={interviews.timeZone}
        interviewNow={interviews.now}
        nextRound={interviews.nextRound}
        linkedContacts={contacts.linked}
        contactDirectory={contacts.directory}
        openReminders={reminders.open}
        completedReminders={reminders.completed}
        reminderToday={reminders.today}
        offer={offer}
        showOffer={offerTabVisible({
          status: job.status,
          hasOffer: offer !== null,
          tab: initialTab,
        })}
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
    tab === "interviews" ||
    tab === "contacts" ||
    tab === "reminders" ||
    tab === "offer"
  ) {
    return tab;
  }
  return pending ? "documents" : "overview";
}

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
