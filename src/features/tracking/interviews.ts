/**
 * Interview scheduling. docs/04-DATA-MODEL.md → Automatic side effects.
 * Date and time are a wall clock in the user's timezone, stored as a UTC instant.
 */

import type { JobStatus } from "@/generated/prisma/enums";
import { calendarDateInTimeZone, isCalendarDate } from "@/features/jobs/dates";

export const INTERVIEW_KINDS = [
  "PHONE_SCREEN",
  "RECRUITER",
  "HIRING_MANAGER",
  "TECHNICAL",
  "BEHAVIOURAL",
  "PANEL",
  "TAKE_HOME",
  "ONSITE",
  "FINAL",
  "OTHER",
] as const;

export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_OUTCOMES = [
  "PENDING",
  "ADVANCED",
  "REJECTED",
  "CANCELLED",
  "UNKNOWN",
] as const;

export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number];

/** Caps: docs/04-DATA-MODEL.md → Interview fields. */
export const INTERVIEW_LIMITS = {
  roundMin: 1,
  roundMax: 20,
  durationMin: 1,
  durationMax: 480,
  locationOrLink: 500,
  interviewers: 300,
  prepNotes: 5_000,
  reflection: 5_000,
} as const;

/** Exact 24 hours, including across a daylight-saving change. */
export const INTERVIEW_LEAD_MS = 24 * 60 * 60 * 1000;

/** Exact 2 hours after the outcome is saved. */
export const THANK_YOU_LEAD_MS = 2 * 60 * 60 * 1000;

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;

const KIND_SET: ReadonlySet<string> = new Set(INTERVIEW_KINDS);
const OUTCOME_SET: ReadonlySet<string> = new Set(INTERVIEW_OUTCOMES);

/** Saved, Applied, and Screening are before Interviewing. Closed statuses are not ordered. */
const BEFORE_INTERVIEWING: ReadonlySet<string> = new Set([
  "SAVED",
  "APPLIED",
  "SCREENING",
]);

export function isInterviewKind(value: string): value is InterviewKind {
  return KIND_SET.has(value);
}

export function isInterviewOutcome(value: string): value is InterviewOutcome {
  return OUTCOME_SET.has(value);
}

/** `YYYY-MM-DDTHH:mm` on a real calendar day. Does not check daylight-saving gaps. */
export function isZonedDateTime(value: string): boolean {
  const match = LOCAL_RE.exec(value);
  if (!match) return false;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  if (!isCalendarDate(date)) return false;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * Wall clock in an IANA timezone, as a UTC instant.
 * An unknown zone is read as UTC. A spring-forward gap returns null.
 * A repeated fall-back hour uses the earlier instant.
 */
export function zonedDateTimeInstant(local: string, timeZone: string): Date | null {
  if (!isZonedDateTime(local)) return null;
  const match = LOCAL_RE.exec(local);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const utcWall = Date.UTC(year, month - 1, day, hour, minute, 0);
  const zone = timeZone.trim();
  const offset = zone ? zoneOffsetMs(new Date(utcWall), zone) : null;
  if (offset === null) return new Date(utcWall);
  const first = utcWall - offset;
  if (wallClock(new Date(first), zone) === local) return new Date(first);
  const settled = zoneOffsetMs(new Date(first), zone);
  if (settled === null) return null;
  const second = utcWall - settled;
  if (wallClock(new Date(second), zone) === local) return new Date(second);
  return null;
}

/** `YYYY-MM-DDTHH:mm` in an IANA timezone. Unknown zones use UTC. */
export function formatInterviewLocal(instant: Date, timeZone: string): string | null {
  const zoned = wallClock(instant, timeZone);
  if (zoned) return zoned;
  return wallClock(instant, "UTC");
}

/** Date and time for the interview list. Unknown zones use UTC. */
export function formatInterviewWhen(instant: Date, timeZone: string): string {
  const formatted = formatWhen(instant, timeZone);
  if (formatted) return formatted;
  return formatWhen(instant, "UTC") ?? instant.toISOString();
}

export function isInterviewLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Next round after the highest one, kept inside 1–20. */
export function nextInterviewRound(rounds: readonly number[]): number {
  const highest = rounds.reduce((max, round) => Math.max(max, round), 0);
  const next = highest + 1;
  if (next < INTERVIEW_LIMITS.roundMin) return INTERVIEW_LIMITS.roundMin;
  if (next > INTERVIEW_LIMITS.roundMax) return INTERVIEW_LIMITS.roundMax;
  return next;
}

export type InterviewSortKey = {
  id: string;
  round: number;
  scheduledAt: Date | null;
  createdAt: Date;
};

/** Round ascending, then time ascending. An undated interview follows dated ones in that round. */
export function compareInterviews(a: InterviewSortKey, b: InterviewSortKey): number {
  if (a.round !== b.round) return a.round - b.round;
  if (a.scheduledAt === null && b.scheduledAt !== null) return 1;
  if (a.scheduledAt !== null && b.scheduledAt === null) return -1;
  if (a.scheduledAt && b.scheduledAt) {
    const byTime = a.scheduledAt.getTime() - b.scheduledAt.getTime();
    if (byTime !== 0) return byTime;
  }
  const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreated !== 0) return byCreated;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export type InterviewMoment = {
  scheduledAt: Date | null;
  outcome: InterviewOutcome;
};

export type InterviewReminderPlan = "keep" | "upsert" | "dismiss";

export type InterviewEffectPlan = {
  /** First time this interview gets a date, and no scheduled event exists yet. */
  scheduleEvent: boolean;
  /** Move Saved, Applied, or Screening to Interviewing. */
  advanceToInterviewing: boolean;
  interviewReminder: InterviewReminderPlan;
  interviewReminderDueAt: Date | null;
  /** First time the outcome leaves Pending. */
  completeEvent: boolean;
  thankYouDueAt: Date | null;
};

/**
 * Side effects for one create or edit.
 * `previous` on create is an undated Pending interview.
 * `alreadyScheduled` / `alreadyCompleted` are existing timeline rows for this interview.
 */
export function planInterviewEffects(input: {
  previous: InterviewMoment;
  next: InterviewMoment;
  status: JobStatus;
  now: Date;
  timeZone: string;
  alreadyScheduled: boolean;
  alreadyCompleted: boolean;
}): InterviewEffectPlan {
  const previousMs = input.previous.scheduledAt?.getTime() ?? null;
  const nextMs = input.next.scheduledAt?.getTime() ?? null;
  const dateChanged = previousMs !== nextMs;
  const firstDate =
    input.next.scheduledAt !== null &&
    input.previous.scheduledAt === null &&
    !input.alreadyScheduled;

  let interviewReminder: InterviewReminderPlan = "keep";
  let interviewReminderDueAt: Date | null = null;
  if (input.next.scheduledAt === null && input.previous.scheduledAt !== null) {
    interviewReminder = "dismiss";
  } else if (input.next.scheduledAt !== null && dateChanged) {
    interviewReminder = "upsert";
    interviewReminderDueAt = new Date(input.next.scheduledAt.getTime() - INTERVIEW_LEAD_MS);
  }

  const completeEvent =
    !input.alreadyCompleted &&
    input.previous.outcome === "PENDING" &&
    input.next.outcome !== "PENDING";

  const thankYouDueAt =
    completeEvent && sameCalendarDay(input.next.scheduledAt, input.now, input.timeZone)
      ? new Date(input.now.getTime() + THANK_YOU_LEAD_MS)
      : null;

  return {
    scheduleEvent: firstDate,
    advanceToInterviewing: firstDate && BEFORE_INTERVIEWING.has(input.status),
    interviewReminder,
    interviewReminderDueAt,
    completeEvent,
    thankYouDueAt,
  };
}

export type InterviewRow = InterviewSortKey & {
  kind: InterviewKind;
  outcome: InterviewOutcome;
  durationMinutes: number | null;
  locationOrLink: string | null;
  interviewers: string | null;
  prepNotes: string | null;
  reflection: string | null;
};

export type InterviewView = {
  id: string;
  round: number;
  kind: InterviewKind;
  outcome: InterviewOutcome;
  scheduledAt: string | null;
  scheduledLocal: string;
  whenLabel: string | null;
  durationMinutes: number | null;
  locationOrLink: string | null;
  link: boolean;
  interviewers: string | null;
  prepNotes: string | null;
  reflection: string | null;
  past: boolean;
};

export function presentInterview(
  row: InterviewRow,
  timeZone: string,
  now: Date,
): InterviewView {
  return {
    id: row.id,
    round: row.round,
    kind: row.kind,
    outcome: row.outcome,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    scheduledLocal: row.scheduledAt
      ? (formatInterviewLocal(row.scheduledAt, timeZone) ?? "")
      : "",
    whenLabel: row.scheduledAt ? formatInterviewWhen(row.scheduledAt, timeZone) : null,
    durationMinutes: row.durationMinutes,
    locationOrLink: row.locationOrLink,
    link: row.locationOrLink !== null && isInterviewLink(row.locationOrLink),
    interviewers: row.interviewers,
    prepNotes: row.prepNotes,
    reflection: row.reflection,
    past: row.scheduledAt !== null && row.scheduledAt.getTime() <= now.getTime(),
  };
}

function sameCalendarDay(
  scheduledAt: Date | null,
  now: Date,
  timeZone: string,
): boolean {
  if (!scheduledAt) return false;
  return (
    calendarDateInTimeZone(scheduledAt, timeZone) === calendarDateInTimeZone(now, timeZone)
  );
}

function formatWhen(instant: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(instant);
  } catch {
    return null;
  }
}

/** `YYYY-MM-DDTHH:mm` in the zone. Null when the zone is unknown. */
function wallClock(instant: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(instant);
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    const year = pick("year");
    const month = pick("month");
    const day = pick("day");
    let hour = pick("hour");
    const minute = pick("minute");
    if (!year || !month || !day || !hour || !minute) return null;
    if (hour === "24") hour = "00";
    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch {
    return null;
  }
}

/** Wall-clock minus UTC, in milliseconds. Null when the zone is unknown. */
function zoneOffsetMs(instant: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(instant);
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    const year = Number(pick("year"));
    const month = Number(pick("month"));
    const day = Number(pick("day"));
    let hour = Number(pick("hour"));
    const minute = Number(pick("minute"));
    const second = Number(pick("second"));
    if ([year, month, day, hour, minute, second].some((value) => Number.isNaN(value))) {
      return null;
    }
    if (hour === 24) hour = 0;
    const wall = Date.UTC(year, month - 1, day, hour, minute, second);
    return wall - instant.getTime();
  } catch {
    return null;
  }
}
