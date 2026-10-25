import Link from "next/link";

import { strings } from "@/copy/strings";
import type { DashboardData } from "@/features/dashboard/queries";
import { jobListHref, parseJobListQuery } from "@/features/jobs/list-params";
import { BOARD_STAGES, type BoardStage } from "@/features/jobs/schemas";

const copy = strings.pages.dashboard;
const detail = strings.jobs.detail;
const empty = strings.jobs.board.emptyValue;

const NUDGE_TEXT = {
  noResponse: copy.nudgeNoResponse,
  deadline: copy.nudgeDeadline,
  offer: copy.nudgeOffer,
} as const;

export function HomeSections({ home }: { home: DashboardData }) {
  return (
    <div className="flex flex-col gap-8">
      <Nudges home={home} />
      <Pipeline home={home} />
      <ThisWeek home={home} />
      <RecentJobs home={home} />
      {home.health ? <LibraryHealthLink health={home.health} /> : null}
    </div>
  );
}

function Nudges({ home }: { home: DashboardData }) {
  return (
    <section aria-labelledby="nudges-heading" className="flex flex-col gap-2">
      <h2 id="nudges-heading" className="text-base font-medium text-ink">
        {copy.nudges}
      </h2>
      {home.nudges.length === 0 ? (
        <p className="text-sm text-slate">{copy.nudgesEmpty}</p>
      ) : (
        <ul aria-label={copy.nudges} className="flex flex-col">
          {home.nudges.map((nudge) => (
            <li key={nudge.id} className="border-b border-line py-3 last:border-b-0">
              <Link
                href={nudge.href}
                className="text-sm font-medium break-words text-ink underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {nudge.company} · {nudge.title}
              </Link>
              <p className="text-sm text-slate">{NUDGE_TEXT[nudge.kind]}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Pipeline({ home }: { home: DashboardData }) {
  const base = parseJobListQuery({});
  return (
    <section aria-labelledby="pipeline-heading" className="flex flex-col gap-3">
      <h2 id="pipeline-heading" className="text-base font-medium text-ink">
        {copy.pipeline}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BOARD_STAGES.map((stage) => (
          <li key={stage}>
            <Link
              href={jobListHref(base, { stage })}
              className="flex h-full flex-col gap-1 rounded-lg border border-line px-3 py-3 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-sm text-ink">{stageName(stage)}</span>
              <span className="text-lg font-medium text-ink tabular-nums">
                {copy.pipelineCount(home.pipeline[stage])}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ThisWeek({ home }: { home: DashboardData }) {
  const tailored =
    home.week.tailoredPercent === null ? empty : `${home.week.tailoredPercent}%`;
  const figures = [
    { label: copy.applications, value: String(home.week.applications) },
    { label: copy.tailored, value: tailored },
    { label: copy.responses, value: String(home.week.responses) },
  ];
  return (
    <section aria-labelledby="week-heading" className="flex flex-col gap-3">
      <h2 id="week-heading" className="text-base font-medium text-ink">
        {copy.thisWeek}
      </h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {figures.map((figure) => (
          <div key={figure.label} className="rounded-lg border border-line px-3 py-3">
            <dt className="text-sm text-slate">{figure.label}</dt>
            <dd className="mt-1 text-lg font-medium text-ink tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RecentJobs({ home }: { home: DashboardData }) {
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
      <h2 id="recent-heading" className="text-base font-medium text-ink">
        {copy.recent}
      </h2>
      {home.recent.length === 0 ? (
        <p className="text-sm text-slate">{copy.recentEmpty}</p>
      ) : (
        <ul aria-label={copy.recent} className="flex flex-col">
          {home.recent.map((job) => (
            <li key={job.id} className="border-b border-line py-3 last:border-b-0">
              <Link
                href={`/jobs/${job.id}`}
                className="text-sm font-medium break-words text-ink underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {job.company} · {job.title}
              </Link>
              <p className="text-sm text-slate">{detail.statuses[job.status]}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LibraryHealthLink({
  health,
}: {
  health: NonNullable<DashboardData["health"]>;
}) {
  const body = copy.completenessLow(health.percent);
  return (
    <section aria-labelledby="health-heading" className="flex flex-col gap-2">
      <h2 id="health-heading" className="text-base font-medium text-ink">
        {copy.healthTitle}
      </h2>
      <Link
        href="/library"
        className="text-sm text-ink underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {body}
      </Link>
    </section>
  );
}

function stageName(stage: BoardStage): string {
  return stage === "CLOSED" ? detail.closedGroup : detail.statuses[stage];
}
