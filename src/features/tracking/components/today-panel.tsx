import Link from "next/link";

import { strings } from "@/copy/strings";

import type { ReminderView, UpcomingInterviewView } from "../reminders";
import { ReminderList } from "./reminder-list";

const page = strings.pages.dashboard;
const interviews = strings.jobs.interviews;

export function TodayPanel({
  due,
  upcoming,
}: {
  due: ReminderView[];
  upcoming: UpcomingInterviewView[];
}) {
  return (
    <section aria-labelledby="today-heading" className="flex flex-col gap-6">
      <h2 id="today-heading" className="text-base font-medium text-ink">
        {page.today}
      </h2>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-ink">{page.reminders}</h3>
        <ReminderList
          reminders={due}
          empty={page.remindersEmpty}
          showJob
          listLabel={page.reminders}
        />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-ink">{page.interviews}</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate">{page.interviewsEmpty}</p>
        ) : (
          <ul aria-label={page.interviews} className="flex flex-col">
            {upcoming.map((interview) => (
              <li
                key={interview.id}
                className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0"
              >
                <Link
                  href={`/jobs/${interview.jobId}?tab=interviews`}
                  className="text-sm font-medium break-words text-ink underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {interview.jobLabel}
                </Link>
                <p className="text-sm text-ink">
                  {interviews.eventLine(interview.round, interviews.kinds[interview.kind])}
                </p>
                <p className="text-xs text-slate">
                  <time dateTime={interview.scheduledAt}>{interview.whenLabel}</time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
