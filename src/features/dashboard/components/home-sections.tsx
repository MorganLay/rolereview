import Link from "next/link";

import { strings } from "@/copy/strings";
import type { DashboardData } from "@/features/dashboard/queries";
import {
  type ActionReason,
  type DashboardAction,
} from "@/features/dashboard/priorities";
import { formatDeadlineLabel } from "@/features/jobs/format";
import { nextActionLabel } from "@/features/jobs/next-action";
import { formatEventWhen } from "@/features/tracking/events";
import {
  INTERVIEW_KINDS,
  formatInterviewWhen,
  type InterviewKind,
} from "@/features/tracking/interviews";

const copy = strings.pages.dashboard;
const interviews = strings.jobs.interviews;
const timeline = strings.jobs.timeline;
const empty = copy.tailoredEmpty;

const KIND_LABELS: Record<InterviewKind, string> = interviews.kinds;

export function HomeSections({ home }: { home: DashboardData }) {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Summary home={home} />
      <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          <ContinueWorking home={home} />
          <ActionList home={home} />
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <RecentActivity home={home} />
          <ThisWeek home={home} />
        </div>
      </div>
    </div>
  );
}

function Summary({ home }: { home: DashboardData }) {
  const figures = [
    { label: copy.summaryActive, value: home.summary.active },
    { label: copy.summaryInterviews, value: home.summary.interviews },
    { label: copy.summaryOffers, value: home.summary.offers },
    { label: copy.summaryUrgent, value: home.summary.urgent },
  ];
  return (
    <section aria-label={copy.summary}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0 rounded-lg border border-line px-3 py-3">
            <dt className="text-sm text-slate">{figure.label}</dt>
            <dd className="mt-1 text-lg font-medium text-ink tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ContinueWorking({ home }: { home: DashboardData }) {
  const work = home.continueWork;
  return (
    <section aria-labelledby="continue-heading" className="flex min-w-0 flex-col gap-2">
      <h2 id="continue-heading" className="text-base font-medium text-ink">
        {copy.continueTitle}
      </h2>
      {work ? (
        <Link
          href={work.href}
          className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-line px-3 py-3 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="text-sm font-medium break-words text-ink">{continueLabel(work)}</span>
          <span className="text-sm break-words text-slate">
            {work.company} · {work.title}
          </span>
        </Link>
      ) : (
        <p className="text-sm text-slate">{copy.continueEmpty}</p>
      )}
    </section>
  );
}

function ActionList({ home }: { home: DashboardData }) {
  return (
    <section aria-labelledby="actions-heading" className="flex min-w-0 flex-col gap-2">
      <h2 id="actions-heading" className="text-base font-medium text-ink">
        {copy.actions}
      </h2>
      {home.actions.length === 0 ? (
        <p className="text-sm text-slate">{copy.actionsEmpty}</p>
      ) : (
        <ul aria-label={copy.actions} className="flex min-w-0 flex-col">
          {home.actions.map((action) => (
            <li key={action.id} className="min-w-0 border-b border-line py-3 last:border-b-0">
              <Link
                href={action.href}
                className="flex min-w-0 flex-col gap-0.5 rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="text-sm font-medium break-words text-ink">{actionWhat(action)}</span>
                <span className="text-sm break-words text-ink">
                  {action.company} · {action.title}
                </span>
                <span className="text-sm break-words text-slate">
                  {actionWhy(action, home.timeZone)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentActivity({ home }: { home: DashboardData }) {
  return (
    <section aria-labelledby="activity-heading" className="flex min-w-0 flex-col gap-2">
      <h2 id="activity-heading" className="text-base font-medium text-ink">
        {copy.activity}
      </h2>
      {home.activity.length === 0 ? (
        <p className="text-sm text-slate">{copy.activityEmpty}</p>
      ) : (
        <ul aria-label={copy.activity} className="flex min-w-0 flex-col">
          {home.activity.map((item) => (
            <li key={item.id} className="min-w-0 border-b border-line py-3 last:border-b-0">
              <Link
                href={item.href}
                className="flex min-w-0 flex-col gap-0.5 rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="text-sm font-medium break-words text-ink">
                  {activityLabel(item.type)}
                </span>
                <span className="text-sm break-words text-ink">
                  {item.company} · {item.title}
                </span>
                <span className="text-sm text-slate">
                  <time dateTime={item.occurredAt.toISOString()}>
                    {formatEventWhen(item.occurredAt, home.timeZone, item.manual)}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ThisWeek({ home }: { home: DashboardData }) {
  const tailored = home.week.tailoredPercent === null ? empty : `${home.week.tailoredPercent}%`;
  const figures = [
    { label: copy.applications, value: String(home.week.applications) },
    { label: copy.tailored, value: tailored },
    { label: copy.responses, value: String(home.week.responses) },
  ];
  return (
    <section aria-labelledby="week-heading" className="flex min-w-0 flex-col gap-3">
      <h2 id="week-heading" className="text-base font-medium text-ink">
        {copy.thisWeek}
      </h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0 rounded-lg border border-line px-3 py-3">
            <dt className="text-sm break-words text-slate">{figure.label}</dt>
            <dd className="mt-1 text-lg font-medium text-ink tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function continueLabel(work: NonNullable<DashboardData["continueWork"]>): string {
  if (work.source === "resume" || work.nextKind === null) return copy.continueResume;
  return nextActionLabel(work.nextKind);
}

function actionWhat(action: DashboardAction): string {
  if (action.reminderTitle) return action.reminderTitle;
  switch (action.kind) {
    case "deadline":
      return copy.deadlineLabel;
    case "offer":
      return copy.offerLabel;
    case "interview":
      return interviewWhat(action);
    case "followUp":
      return copy.followUpLabel;
    case "document":
      return copy.documentLabel;
    default: {
      const unreachable: never = action.kind;
      return unreachable;
    }
  }
}

function interviewWhat(action: DashboardAction): string {
  const round =
    action.interviewRound === null ? null : interviews.roundTitle(action.interviewRound);
  const kind = interviewKindLabel(action.interviewKind);
  if (round && kind) return `${round} · ${kind}`;
  return round ?? kind ?? copy.interviewLabel;
}

function interviewKindLabel(kind: string | null): string | null {
  if (!kind || !(INTERVIEW_KINDS as readonly string[]).includes(kind)) return null;
  return KIND_LABELS[kind as InterviewKind];
}

function actionWhy(action: DashboardAction, timeZone: string): string {
  return reasonWhy(action.reason, timeZone);
}

function reasonWhy(reason: ActionReason, timeZone: string): string {
  switch (reason.type) {
    case "deadline":
      if (reason.timing === "overdue") return copy.deadlineOverdue(formatDeadlineLabel(reason.date));
      if (reason.timing === "today") return copy.deadlineToday;
      return copy.deadlineUpcoming(formatDeadlineLabel(reason.date));
    case "offer":
      if (reason.timing === "overdue") return copy.offerOverdue(formatDeadlineLabel(reason.date));
      if (reason.timing === "today") return copy.offerToday;
      return copy.offerUpcoming(formatDeadlineLabel(reason.date));
    case "interview":
      if (reason.soon) return copy.interviewSoon;
      return copy.interviewLater(formatInterviewWhen(new Date(reason.at), timeZone));
    case "followUpDue":
      if (reason.timing === "overdue") return copy.followUpOverdue(formatDeadlineLabel(reason.date));
      if (reason.timing === "today") return copy.followUpToday;
      return copy.followUpUpcoming(formatDeadlineLabel(reason.date));
    case "followUpNext":
      return reason.stale ? copy.followUpStale : copy.followUpNext;
    case "document":
      return reason.exported ? copy.documentInProgress : copy.documentUnexported;
    default: {
      const unreachable: never = reason;
      return unreachable;
    }
  }
}

function activityLabel(type: string): string {
  if (isTimelineType(type)) return timeline.types[type];
  return copy.activityFallback;
}

function isTimelineType(type: string): type is keyof typeof timeline.types {
  return type in timeline.types;
}
