import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import type { LibraryOverview } from "@/features/dashboard/library-overview";
import type { DashboardData } from "@/features/dashboard/queries";
import {
  type ActionReason,
  type ContinueKind,
  type ContinueWork,
  type DashboardAction,
  type RecentApplication,
} from "@/features/dashboard/priorities";
import { NewJobLink } from "@/features/jobs/components/new-job-link";
import { calendarDateInTimeZone, deadlineUrgency } from "@/features/jobs/dates";
import { boardCardTitle, formatDeadlineLabel, formatJobInstant } from "@/features/jobs/format";
import { nextActionLabel } from "@/features/jobs/next-action";
import {
  INTERVIEW_KINDS,
  formatInterviewWhen,
  type InterviewKind,
} from "@/features/tracking/interviews";

const copy = strings.pages.dashboard;
const interviews = strings.jobs.interviews;

const KIND_LABELS: Record<InterviewKind, string> = interviews.kinds;

const rowLink =
  "flex min-w-0 flex-col gap-0.5 rounded-sm px-4 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5";

export function HomeSections({ home }: { home: DashboardData }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Top home={home} />
      <Overview home={home} />
      {home.tracked > 0 ? <Attention home={home} /> : null}
      {home.recent.length > 0 ? <Recent home={home} /> : null}
    </div>
  );
}

function Top({ home }: { home: DashboardData }) {
  const emptyLibrary = home.library.focus === "empty";
  const work = home.continueWork;

  if (emptyLibrary && work) {
    return (
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <Continue work={work} />
        <LibraryEmpty paired />
      </div>
    );
  }
  if (emptyLibrary) return <LibraryEmpty paired={false} />;
  if (work) {
    return (
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <Continue work={work} />
        <StartRole paired />
      </div>
    );
  }
  return <StartRole paired={false} />;
}

function StartRole({ paired }: { paired: boolean }) {
  return (
    <section
      aria-labelledby="start-heading"
      className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-4 sm:px-5"
    >
      <div
        className={
          paired
            ? "flex flex-1 flex-col"
            : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        <div className="min-w-0">
          <h2
            id="start-heading"
            className="font-serif text-lg font-semibold tracking-tight text-balance text-ink"
          >
            {copy.startTitle}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate">{copy.startBody}</p>
        </div>
        <Button
          asChild
          variant={paired ? "outline" : "default"}
          className={paired ? "mt-4 w-full lg:mt-auto lg:w-auto" : "w-full shrink-0 sm:w-auto"}
        >
          <NewJobLink>{strings.actions.newJob}</NewJobLink>
        </Button>
      </div>
    </section>
  );
}

function LibraryEmpty({ paired }: { paired: boolean }) {
  return (
    <section
      aria-labelledby="library-empty-heading"
      className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-4 sm:px-5"
    >
      <h2
        id="library-empty-heading"
        className="font-serif text-lg font-semibold tracking-tight text-balance text-ink"
      >
        {copy.libraryEmptyTitle}
      </h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate">{copy.libraryEmptyBody}</p>
      <div
        className={
          paired
            ? "mt-4 flex flex-col gap-2 sm:flex-row lg:mt-auto"
            : "mt-4 flex flex-col gap-2 sm:flex-row"
        }
      >
        <Button asChild className="w-full sm:w-auto">
          <Link href="/library/import">{strings.library.importResume}</Link>
        </Button>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <NewJobLink>{strings.actions.newJob}</NewJobLink>
        </Button>
      </div>
      <Link
        href="/library"
        className="mt-3 w-fit text-sm font-medium text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {copy.libraryEmptyManual}
      </Link>
    </section>
  );
}

function Continue({ work }: { work: ContinueWork }) {
  const status = strings.jobs.detail.statuses[work.jobStatus];
  return (
    <section
      aria-labelledby="continue-heading"
      className="flex h-full flex-col rounded-card border border-line bg-surface px-4 py-4 sm:px-5"
    >
      <p className="text-xs font-medium tracking-wide text-pine uppercase">{copy.continueTitle}</p>
      <h2
        id="continue-heading"
        className="mt-1 font-serif text-lg font-semibold tracking-tight text-balance text-ink"
      >
        {boardCardTitle(work.title)}
      </h2>
      <p className="mt-1 text-sm break-words text-ink">
        {work.company} · {status}
      </p>
      <p className="mt-1 text-sm text-slate">{copy.continueDetail[work.kind]}</p>
      <Button asChild className="mt-4 w-full lg:mt-auto lg:w-auto">
        <Link href={work.href}>{continueAction(work.kind)}</Link>
      </Button>
    </section>
  );
}

function Overview({ home }: { home: DashboardData }) {
  const showLibrary = home.library.focus !== "empty";
  const showApplications = home.tracked > 0;
  if (!showLibrary && !showApplications) return null;
  if (showLibrary && showApplications) {
    return (
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <LibraryCard library={home.library} />
        <Applications home={home} paired />
      </div>
    );
  }
  if (showLibrary) return <LibraryCard library={home.library} />;
  return <Applications home={home} paired={false} />;
}

function LibraryCard({ library }: { library: LibraryOverview }) {
  const improve = library.focus !== "ready";
  return (
    <section
      aria-labelledby="library-heading"
      className="rounded-card border border-line bg-surface px-4 py-4 sm:px-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="library-heading" className="text-base font-medium text-ink">
            {copy.libraryTitle}
          </h2>
          {library.bulletCount > 0 ? (
            <p className="mt-1 text-sm text-ink">
              {copy.libraryStrength(library.strongOrBetter, library.bulletCount)}
            </p>
          ) : null}
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate">{librarySentence(library)}</p>
        </div>
        <Button variant="outline" asChild className="w-full shrink-0 sm:w-auto">
          <Link href="/library">{improve ? copy.libraryImprove : copy.libraryOpen}</Link>
        </Button>
      </div>
    </section>
  );
}

function Applications({ home, paired }: { home: DashboardData; paired: boolean }) {
  const figures = [
    { label: copy.applicationsActive, value: home.summary.active },
    { label: copy.applicationsSent, value: home.week.applications },
    { label: copy.applicationsInterviews, value: home.summary.interviews },
    { label: copy.applicationsTailored, value: home.week.tailored },
  ];
  return (
    <section
      aria-labelledby="applications-heading"
      className="overflow-hidden rounded-card border border-line bg-surface"
    >
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4 sm:px-5">
        <h2 id="applications-heading" className="text-base font-medium text-ink">
          {copy.applicationsTitle}
        </h2>
        <Link
          href="/jobs"
          className="shrink-0 text-sm font-medium text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {copy.applicationsBoard}
        </Link>
      </div>
      <dl
        className={
          paired
            ? "mt-3 grid grid-cols-2 gap-px bg-line"
            : "mt-3 grid grid-cols-2 gap-px bg-line sm:grid-cols-4"
        }
      >
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0 bg-surface px-4 py-3 sm:px-5">
            <dt className="text-sm text-slate">{figure.label}</dt>
            <dd className="mt-1 text-lg font-medium text-ink tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Attention({ home }: { home: DashboardData }) {
  return (
    <section aria-labelledby="attention-heading" className="flex min-w-0 flex-col gap-2">
      <h2 id="attention-heading" className="text-base font-medium text-ink">
        {copy.attention}
      </h2>
      {home.attention.length === 0 ? (
        <p className="text-sm text-slate">{copy.attentionEmpty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {home.attention.map((action) => (
            <li key={action.id}>
              <Link href={action.href} className={rowLink}>
                <span className="text-sm font-medium break-words text-ink">{actionWhat(action)}</span>
                <span className="text-sm break-words text-ink">
                  {action.company} · {boardCardTitle(action.title)}
                </span>
                <span className="text-sm break-words text-slate">{actionWhy(action, home.timeZone)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Recent({ home }: { home: DashboardData }) {
  const today = calendarDateInTimeZone(home.asOf, home.timeZone);
  return (
    <section aria-labelledby="recent-heading" className="flex min-w-0 flex-col gap-2">
      <h2 id="recent-heading" className="text-base font-medium text-ink">
        {copy.recent}
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {home.recent.map((job) => (
          <li key={job.id}>
            <Link href={job.href} className={rowLink}>
              <span className="text-sm font-medium break-words text-ink">{boardCardTitle(job.title)}</span>
              <span className="text-sm break-words text-ink">
                {job.company} · {strings.jobs.detail.statuses[job.status]}
              </span>
              <span className="text-sm text-slate">{recentWhen(job, home.timeZone, today)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function continueAction(kind: ContinueKind): string {
  switch (kind) {
    case "tailoring":
      return copy.continueTailoring;
    case "open":
      return copy.continueOpen;
    case "review":
    case "tailor":
    case "preview":
      return nextActionLabel(kind);
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

function librarySentence(library: LibraryOverview): string {
  if (library.bulletCount === 0) return copy.libraryEmptyBullets;
  switch (library.focus) {
    case "wording":
      return copy.libraryWording(library.wording);
    case "evidence":
      return copy.libraryEvidence(library.evidence);
    case "completeness":
      return copy.libraryCompleteness(library.percent);
    case "ready":
    case "empty":
      return copy.libraryReady;
    default: {
      const unreachable: never = library.focus;
      return unreachable;
    }
  }
}

function recentWhen(job: RecentApplication, timeZone: string, today: string): string {
  if (job.deadline) {
    const urgency = deadlineUrgency(job.deadline, today);
    if (urgency === "past" || urgency === "soon") {
      return copy.recentDeadline(formatDeadlineLabel(job.deadline));
    }
  }
  if (job.appliedAt) {
    return copy.recentApplied(formatJobInstant(job.appliedAt.toISOString(), timeZone));
  }
  if (job.deadline) return copy.recentDeadline(formatDeadlineLabel(job.deadline));
  return copy.recentUpdated(formatJobInstant(job.updatedAt.toISOString(), timeZone));
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
