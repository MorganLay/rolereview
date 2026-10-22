/**
 * Insights figures. Nothing is stored. Definitions: docs/04-DATA-MODEL.md → Analytics.
 *
 * The activity streak is Release 1.1. Weekly bars here are applications per
 * Monday-start week, tailored against not.
 */

import { addCalendarDays } from "@/features/dashboard/metrics";
import { calendarDateInTimeZone, deadlineInstant } from "@/features/jobs/dates";
import {
  isJobStatus,
  JOB_SOURCES,
  type JobSourceValue,
  type JobStatusValue,
} from "@/features/jobs/schemas";
import { zonedDateTimeInstant } from "@/features/tracking/interviews";

/** Groups below this are omitted. Shown groups carry the application count. */
export const BREAKDOWN_MIN_APPLICATIONS = 5;

/** Exactly 7×24 hours, matching the follow-up reminder. */
export const RESPONSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const INSIGHTS_RANGES = ["30d", "90d", "all"] as const;

export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

/** 30 days when the query is missing or not one of the three ranges. */
export function parseInsightsRange(value: string | string[] | undefined): InsightsRange {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "30d" || raw === "90d" || raw === "all") return raw;
  return "30d";
}

/** Missing source. Real sources use the `JobSource` values. */
export const SOURCE_NONE = "NONE";

export const MATCH_BANDS = ["UNDER_50", "FROM_50_TO_74", "FROM_75"] as const;

export type MatchBand = (typeof MATCH_BANDS)[number];

export const TAILORED_KEYS = ["TAILORED", "NOT_TAILORED"] as const;

export type TailoredKey = (typeof TAILORED_KEYS)[number];

export type InsightsJob = {
  status: JobStatusValue;
  source: JobSourceValue | null;
  appliedAt: Date | null;
  /** When the job was added. Saved jobs have no `appliedAt`. */
  createdAt: Date;
  firstResponseAt: Date | null;
  submittedResumeId: string | null;
  /** Score of the submitted resume. Ignored when no resume was submitted. */
  matchScore: number | null;
  /** Interview rows, including ones with no date. */
  interviewCount: number;
  /** A timeline event shows the job reached Offer or Accepted. */
  offerEvent: boolean;
};

export type InsightsRate = {
  count: number;
  /** Denominator. Zero means the rate is undefined. */
  of: number;
  rate: number | null;
};

export type InsightsBreakdown = {
  key: string;
  applications: number;
  response: InsightsRate;
  interview: InsightsRate;
  offer: InsightsRate;
  medianDaysToResponse: number | null;
};

export type InsightsWeek = {
  /** Monday `YYYY-MM-DD` in the user's timezone. */
  weekStart: string;
  tailored: number;
  notTailored: number;
};

/** Saved through Offer. Each later stage is also counted in the earlier ones. */
export const FUNNEL_STAGES = [
  "SAVED",
  "APPLIED",
  "RESPONDED",
  "INTERVIEWED",
  "OFFER",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export type InsightsFunnelStage = {
  key: FunnelStage;
  count: number;
  /** Share of the previous stage. Empty on Saved, or when that stage is 0. */
  fromPrevious: number | null;
};

export type InsightsMetrics = {
  applied: number;
  response: InsightsRate;
  interview: InsightsRate;
  offer: InsightsRate;
  medianDaysToResponse: number | null;
  bySource: InsightsBreakdown[];
  byMatchBand: InsightsBreakdown[];
  tailored: InsightsBreakdown[];
  weeks: InsightsWeek[];
  funnel: InsightsFunnelStage[];
};

type JobInput = {
  status: string;
  source: string | null;
  appliedAt: Date | null;
  createdAt: Date;
  firstResponseAt: Date | null;
  submittedResumeId: string | null;
  matchScore: number | null;
  interviewCount: number;
  offerEvent: boolean;
};

const SOURCE_SET: ReadonlySet<string> = new Set(JOB_SOURCES);

/** Drop an unknown status. An unknown source counts as none. */
export function toInsightsJob(row: JobInput): InsightsJob | null {
  if (!isJobStatus(row.status)) return null;
  return {
    status: row.status,
    source: row.source && SOURCE_SET.has(row.source) ? (row.source as JobSourceValue) : null,
    appliedAt: row.appliedAt,
    createdAt: row.createdAt,
    firstResponseAt: row.firstResponseAt,
    submittedResumeId: row.submittedResumeId,
    matchScore: row.matchScore,
    interviewCount: row.interviewCount,
    offerEvent: row.offerEvent,
  };
}

/**
 * Local midnight at the start of a 30- or 90-day window. All time has no start.
 * 30 days is today and the previous 29 calendar days.
 */
export function insightsRangeStart(
  range: InsightsRange,
  now: Date,
  timeZone: string,
): Date | null {
  if (range === "all") return null;
  const today = calendarDateInTimeZone(now, timeZone);
  const startDay = addCalendarDays(today, range === "30d" ? -29 : -89);
  return localMidnight(startDay, timeZone);
}

export function insightsMetrics(
  jobs: readonly InsightsJob[],
  options: { range: InsightsRange; now: Date; timeZone: string },
): InsightsMetrics {
  const start = insightsRangeStart(options.range, options.now, options.timeZone);
  const applied = jobs.filter((job) => inRange(job.appliedAt, start, options.now));
  const headline = figures(applied, options.now);

  return {
    applied: applied.length,
    ...headline,
    bySource: breakdown(applied, options.now, sourceKey, [...JOB_SOURCES, SOURCE_NONE]),
    byMatchBand: breakdown(applied, options.now, bandKey, MATCH_BANDS),
    tailored: breakdown(applied, options.now, tailoredKey, TAILORED_KEYS),
    weeks: applicationWeeks(applied, start, options.now, options.timeZone),
    funnel: insightsFunnel(jobs, start, options.now),
  };
}

function inRange(appliedAt: Date | null, start: Date | null, now: Date): appliedAt is Date {
  if (!appliedAt) return false;
  const time = appliedAt.getTime();
  if (time > now.getTime()) return false;
  if (!start) return true;
  return time >= start.getTime();
}

function figures(jobs: readonly InsightsJob[], now: Date) {
  const eligible = jobs.filter((job) => responseEligible(job, now));
  const responded = eligible.filter((job) => job.firstResponseAt !== null);
  const interviewed = jobs.filter((job) => job.interviewCount >= 1);
  const offers = jobs.filter(reachedOffer);
  const days: number[] = [];
  for (const job of jobs) {
    if (!job.appliedAt || !job.firstResponseAt) continue;
    days.push((job.firstResponseAt.getTime() - job.appliedAt.getTime()) / DAY_MS);
  }
  return {
    response: rate(responded.length, eligible.length),
    interview: rate(interviewed.length, jobs.length),
    offer: rate(offers.length, jobs.length),
    medianDaysToResponse: median(days),
  };
}

function responseEligible(job: InsightsJob, now: Date): boolean {
  if (!job.appliedAt) return false;
  return now.getTime() - job.appliedAt.getTime() >= RESPONSE_WINDOW_MS;
}

function reachedOffer(job: InsightsJob): boolean {
  return job.status === "OFFER" || job.status === "ACCEPTED" || job.offerEvent;
}

/** An interview or an offer counts as a response so the funnel only narrows. */
function reachedResponse(job: InsightsJob): boolean {
  return job.firstResponseAt !== null || reachedInterview(job);
}

/** An offer counts as interviewed so the funnel only narrows. */
function reachedInterview(job: InsightsJob): boolean {
  return job.interviewCount >= 1 || reachedOffer(job);
}

/**
 * Jobs applied in the window, plus jobs still saved whose createdAt is in the window.
 * A job that already has appliedAt is dated by that, not by createdAt.
 */
function insightsFunnel(
  jobs: readonly InsightsJob[],
  start: Date | null,
  now: Date,
): InsightsFunnelStage[] {
  const windowed = jobs.filter((job) =>
    job.appliedAt ? inRange(job.appliedAt, start, now) : inRange(job.createdAt, start, now),
  );
  const applied = windowed.filter((job) => job.appliedAt !== null);
  const counts = [
    windowed.length,
    applied.length,
    applied.filter(reachedResponse).length,
    applied.filter(reachedInterview).length,
    applied.filter(reachedOffer).length,
  ];
  return FUNNEL_STAGES.map((key, index) => {
    const count = counts[index] ?? 0;
    const previous = index === 0 ? null : (counts[index - 1] ?? 0);
    return {
      key,
      count,
      fromPrevious: previous === null || previous === 0 ? null : count / previous,
    };
  });
}

function rate(count: number, of: number): InsightsRate {
  return { count, of, rate: of === 0 ? null : count / of };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (lower === undefined || upper === undefined) return null;
  return (lower + upper) / 2;
}

function breakdown(
  jobs: readonly InsightsJob[],
  now: Date,
  keyOf: (job: InsightsJob) => string | null,
  order: readonly string[],
): InsightsBreakdown[] {
  const buckets = new Map<string, InsightsJob[]>();
  for (const job of jobs) {
    const key = keyOf(job);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(job);
    else buckets.set(key, [job]);
  }
  const groups: InsightsBreakdown[] = [];
  for (const key of order) {
    const rows = buckets.get(key);
    if (!rows || rows.length < BREAKDOWN_MIN_APPLICATIONS) continue;
    groups.push({ key, applications: rows.length, ...figures(rows, now) });
  }
  return groups;
}

function sourceKey(job: InsightsJob): string {
  return job.source ?? SOURCE_NONE;
}

function bandKey(job: InsightsJob): MatchBand | null {
  if (!job.submittedResumeId || job.matchScore === null) return null;
  if (job.matchScore < 50) return "UNDER_50";
  if (job.matchScore < 75) return "FROM_50_TO_74";
  return "FROM_75";
}

function tailoredKey(job: InsightsJob): TailoredKey {
  return job.submittedResumeId ? "TAILORED" : "NOT_TAILORED";
}

function applicationWeeks(
  applied: readonly InsightsJob[],
  rangeStart: Date | null,
  now: Date,
  timeZone: string,
): InsightsWeek[] {
  const earliest = rangeStart ?? earliestApplied(applied);
  if (!earliest || applied.length === 0) return [];
  const startMonday = mondayOf(calendarDateInTimeZone(earliest, timeZone));
  const endMonday = mondayOf(calendarDateInTimeZone(now, timeZone));
  if (startMonday > endMonday) return [];

  const buckets: InsightsWeek[] = [];
  for (let cursor = startMonday; cursor <= endMonday; cursor = addCalendarDays(cursor, 7)) {
    buckets.push({ weekStart: cursor, tailored: 0, notTailored: 0 });
  }
  const index = new Map(buckets.map((bucket, at) => [bucket.weekStart, at]));
  for (const job of applied) {
    if (!job.appliedAt) continue;
    const at = index.get(mondayOf(calendarDateInTimeZone(job.appliedAt, timeZone)));
    if (at === undefined) continue;
    const bucket = buckets[at];
    if (!bucket) continue;
    if (job.submittedResumeId) bucket.tailored += 1;
    else bucket.notTailored += 1;
  }
  return buckets;
}

function earliestApplied(jobs: readonly InsightsJob[]): Date | null {
  let earliest: Date | null = null;
  for (const job of jobs) {
    if (!job.appliedAt) continue;
    if (!earliest || job.appliedAt.getTime() < earliest.getTime()) earliest = job.appliedAt;
  }
  return earliest;
}

/** Monday is 0. The weekday belongs to the civil date, not the server zone. */
function mondayOf(iso: string): string {
  return addCalendarDays(iso, -isoMondayIndex(iso));
}

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
