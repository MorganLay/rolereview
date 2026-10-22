/**
 * Dashboard figures. Nothing is stored: nudges, the snapshot, and this week
 * are computed from jobs. docs/02-USER-FLOWS.md → /dashboard.
 *
 * This week is Monday 00:00 through the next Monday, in the user's timezone.
 * A missing local midnight uses 01:00, matching reminder "today".
 */

import {
  calendarDateInTimeZone,
  daysUntilDeadline,
  deadlineInstant,
  deadlineUrgency,
} from "@/features/jobs/dates";
import {
  BOARD_STAGES,
  isClosedJobStatus,
  type BoardStage,
  type JobStatusValue,
} from "@/features/jobs/schemas";
import { zonedDateTimeInstant } from "@/features/tracking/interviews";

export const RECENT_JOB_LIMIT = 5;
export const NO_RESPONSE_DAYS = 30;
export const HEALTH_NUDGE_BELOW = 70;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type NudgeKind = "noResponse" | "deadline" | "offer";

export type NudgeJob = {
  id: string;
  company: string;
  title: string;
  status: JobStatusValue;
  archived: boolean;
  appliedAt: Date | null;
  deadline: string | null;
  respondBy: string | null;
};

export type Nudge = {
  id: string;
  jobId: string;
  company: string;
  title: string;
  kind: NudgeKind;
  href: string;
};

export type PipelineJob = {
  status: JobStatusValue;
  archived: boolean;
};

export type WeekJob = {
  archived: boolean;
  appliedAt: Date | null;
  firstResponseAt: Date | null;
  submittedResumeId: string | null;
};

export type ThisWeek = {
  applications: number;
  /** Null when no applications were sent this week. */
  tailoredPercent: number | null;
  responses: number;
};

export type RecentJob = {
  id: string;
  updatedAt: Date;
  archived: boolean;
};

export type OnboardingCounts = {
  entries: number;
  jobs: number;
  readyResumes: number;
  exportedResumes: number;
};

export const ONBOARDING_STEP_IDS = ["library", "job", "tailor", "export"] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStep = {
  id: OnboardingStepId;
  done: boolean;
};

const KIND_ORDER: Record<NudgeKind, number> = {
  noResponse: 0,
  deadline: 1,
  offer: 2,
};

/** Monday 00:00 inclusive, next Monday 00:00 exclusive, in `timeZone`. */
export function weekBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const today = calendarDateInTimeZone(now, timeZone);
  const monday = addCalendarDays(today, -isoMondayIndex(today));
  const nextMonday = addCalendarDays(monday, 7);
  return {
    start: localMidnight(monday, timeZone),
    end: localMidnight(nextMonday, timeZone),
  };
}

/** Shift a real `YYYY-MM-DD` by whole calendar days. Other strings pass through. */
export function addCalendarDays(iso: string, days: number): string {
  const match = DATE_RE.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Catch-up items for jobs that are not archived.
 * No response: still Applied, and `appliedAt` is at least 30 calendar days
 * before today. Deadlines and offer respond-by dates use the same Soon
 * window as the jobs list: today through three days ahead.
 */
export function dashboardNudges(
  jobs: readonly NudgeJob[],
  now: Date,
  timeZone: string,
): Nudge[] {
  const today = calendarDateInTimeZone(now, timeZone);
  const nudges: (Nudge & { sort: string })[] = [];

  for (const job of jobs) {
    if (job.archived) continue;
    if (isNoResponse(job, today, timeZone)) {
      nudges.push(nudge(job, "noResponse", job.appliedAt?.toISOString() ?? ""));
    }
    if (job.deadline && deadlineUrgency(job.deadline, today) === "soon") {
      nudges.push(nudge(job, "deadline", job.deadline));
    }
    if (job.respondBy && deadlineUrgency(job.respondBy, today) === "soon") {
      nudges.push(nudge(job, "offer", job.respondBy));
    }
  }

  nudges.sort((a, b) => {
    const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (byKind !== 0) return byKind;
    if (a.kind === "noResponse") {
      const byAge = a.sort.localeCompare(b.sort);
      if (byAge !== 0) return byAge;
    } else if (a.sort !== b.sort) {
      return a.sort < b.sort ? -1 : 1;
    }
    return a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0;
  });

  return nudges.map((item) => ({
    id: item.id,
    jobId: item.jobId,
    company: item.company,
    title: item.title,
    kind: item.kind,
    href: item.href,
  }));
}

/** Counts for the six board stages. Archived jobs are left out. */
export function pipelineCounts(
  jobs: readonly PipelineJob[],
): Record<BoardStage, number> {
  const counts = emptyCounts();
  for (const job of jobs) {
    if (job.archived) continue;
    if (isClosedJobStatus(job.status)) counts.CLOSED += 1;
    else counts[job.status] += 1;
  }
  return counts;
}

/**
 * Applications sent (`appliedAt`), the share of those with a submitted resume,
 * and responses (`firstResponseAt`). Zero applications leave the share empty.
 */
export function thisWeek(
  jobs: readonly WeekJob[],
  now: Date,
  timeZone: string,
): ThisWeek {
  const bounds = weekBounds(now, timeZone);
  let applications = 0;
  let tailored = 0;
  let responses = 0;

  for (const job of jobs) {
    if (job.archived) continue;
    if (job.appliedAt && inWeek(job.appliedAt, bounds)) {
      applications += 1;
      if (job.submittedResumeId) tailored += 1;
    }
    if (job.firstResponseAt && inWeek(job.firstResponseAt, bounds)) {
      responses += 1;
    }
  }

  return {
    applications,
    tailoredPercent:
      applications === 0 ? null : Math.round((tailored / applications) * 100),
    responses,
  };
}

/** Newest `updatedAt` first. The same instant uses the lower id. Archived jobs are left out. */
export function recentJobs<T extends RecentJob>(
  jobs: readonly T[],
  limit = RECENT_JOB_LIMIT,
): T[] {
  return jobs
    .filter((job) => !job.archived)
    .sort((a, b) => {
      const byTime = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (byTime !== 0) return byTime;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, limit);
}

export function onboardingSteps(counts: OnboardingCounts): OnboardingStep[] {
  return [
    { id: "library", done: counts.entries >= 1 },
    { id: "job", done: counts.jobs >= 1 },
    { id: "tailor", done: counts.readyResumes >= 1 },
    { id: "export", done: counts.exportedResumes >= 1 },
  ];
}

export function onboardingComplete(steps: readonly OnboardingStep[]): boolean {
  return steps.length > 0 && steps.every((step) => step.done);
}

function isNoResponse(job: NudgeJob, today: string, timeZone: string): boolean {
  if (job.status !== "APPLIED" || !job.appliedAt) return false;
  const applied = calendarDateInTimeZone(job.appliedAt, timeZone);
  const age = daysUntilDeadline(today, applied);
  return age !== null && age >= NO_RESPONSE_DAYS;
}

function nudge(job: NudgeJob, kind: NudgeKind, sort: string): Nudge & { sort: string } {
  return {
    id: `${job.id}:${kind}`,
    jobId: job.id,
    company: job.company,
    title: job.title,
    kind,
    href: kind === "offer" ? `/jobs/${job.id}?tab=offer` : `/jobs/${job.id}`,
    sort,
  };
}

function emptyCounts(): Record<BoardStage, number> {
  return Object.fromEntries(BOARD_STAGES.map((stage) => [stage, 0])) as Record<
    BoardStage,
    number
  >;
}

function inWeek(instant: Date, bounds: { start: Date; end: Date }): boolean {
  const time = instant.getTime();
  return time >= bounds.start.getTime() && time < bounds.end.getTime();
}

/** Monday is 0. The weekday belongs to the civil date, not the server zone. */
function isoMondayIndex(iso: string): number {
  const match = DATE_RE.exec(iso);
  if (!match) return 0;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const sundayZero = date.getUTCDay();
  return sundayZero === 0 ? 6 : sundayZero - 1;
}

function localMidnight(iso: string, timeZone: string): Date {
  return (
    zonedDateTimeInstant(`${iso}T00:00`, timeZone) ??
    zonedDateTimeInstant(`${iso}T01:00`, timeZone) ??
    deadlineInstant(iso)
  );
}
