/**
 * Reminder lists. A reminder is a row in the account, shown in the app.
 * "Today" ends at the next local midnight. Snooze is exactly 24 hours from now.
 */

import { strings } from "@/copy/strings";
import {
  calendarDateInTimeZone,
  daysUntilDeadline,
  formatDeadlineDate,
  isCalendarDate,
} from "@/features/jobs/dates";
import { formatDeadlineLabel } from "@/features/jobs/format";

import { formatEventWhen } from "./events";
import {
  formatInterviewWhen,
  zonedDateTimeInstant,
  type InterviewKind,
} from "./interviews";

export const REMINDER_LIMITS = {
  title: 120,
} as const;

/** Exact 24 hours, including across a daylight-saving change. */
export const SNOOZE_MS = 24 * 60 * 60 * 1000;

/** Interviews that start from now through this many milliseconds. */
export const UPCOMING_INTERVIEW_MS = 48 * 60 * 60 * 1000;

export const REMINDER_KINDS = [
  "FOLLOW_UP",
  "DEADLINE",
  "INTERVIEW",
  "THANK_YOU",
  "OFFER_RESPONSE",
  "CUSTOM",
] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(REMINDER_KINDS);

export function isReminderKind(value: string): value is ReminderKind {
  return KIND_SET.has(value);
}

/** Automatic deadline reminder. A long company name is cut at the title cap. */
export function deadlineReminderTitle(company: string): string {
  const name = company.trim();
  const title =
    name.length > 0 ? strings.jobs.reminder.deadlineFor(name) : strings.jobs.reminder.deadline;
  return title.length <= REMINDER_LIMITS.title ? title : title.slice(0, REMINDER_LIMITS.title);
}

/** Due again 24 hours after `now`. */
export function snoozeDueAt(now: Date): Date {
  return new Date(now.getTime() + SNOOZE_MS);
}

/**
 * The first instant of the next calendar day in an IANA timezone.
 * An unknown zone uses the next UTC midnight. A missing midnight uses 01:00.
 */
export function startOfNextLocalDay(now: Date, timeZone: string): Date {
  const today = calendarDateInTimeZone(now, timeZone);
  const next = addCalendarDay(today);
  const midnight = zonedDateTimeInstant(`${next}T00:00`, timeZone);
  if (midnight) return midnight;
  const one = zonedDateTimeInstant(`${next}T01:00`, timeZone);
  if (one) return one;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(next);
  if (!match) return new Date(now.getTime() + SNOOZE_MS);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** Open, and due before the next local midnight. Includes earlier days. */
export function isDueOrOverdue(dueAt: Date, now: Date, timeZone: string): boolean {
  return dueAt.getTime() < startOfNextLocalDay(now, timeZone).getTime();
}

/** Starts now or later, and no later than 48 hours from now. */
export function isUpcomingInterview(
  scheduledAt: Date,
  now: Date,
  windowMs = UPCOMING_INTERVIEW_MS,
): boolean {
  const at = scheduledAt.getTime();
  const start = now.getTime();
  return at >= start && at <= start + windowMs;
}

export function upcomingWindow(now: Date): { from: Date; to: Date } {
  return { from: now, to: new Date(now.getTime() + UPCOMING_INTERVIEW_MS) };
}

export type OpenReminderSortKey = {
  dueAt: Date;
  createdAt: Date;
  id: string;
};

/** Soonest due first. The same instant uses the earlier createdAt, then id. */
export function compareOpenReminders(a: OpenReminderSortKey, b: OpenReminderSortKey): number {
  const byDue = a.dueAt.getTime() - b.dueAt.getTime();
  if (byDue !== 0) return byDue;
  const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreated !== 0) return byCreated;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export type CompletedReminderSortKey = {
  completedAt: Date;
  id: string;
};

/** Latest completedAt first, then id. */
export function compareCompletedReminders(
  a: CompletedReminderSortKey,
  b: CompletedReminderSortKey,
): number {
  const byDone = b.completedAt.getTime() - a.completedAt.getTime();
  if (byDone !== 0) return byDone;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

type SplitReminder = OpenReminderSortKey & {
  completedAt: Date | null;
  dismissedAt: Date | null;
};

/**
 * Open reminders have neither timestamp. Completed ones have `completedAt`.
 * Dismissed rows are left out of both lists.
 */
export function splitJobReminders<T extends SplitReminder>(
  rows: readonly T[],
): { open: T[]; completed: Array<T & { completedAt: Date }> } {
  const open: T[] = [];
  const completed: Array<T & { completedAt: Date }> = [];
  for (const row of rows) {
    if (row.completedAt === null && row.dismissedAt === null) {
      open.push(row);
    } else if (row.completedAt !== null) {
      completed.push(row as T & { completedAt: Date });
    }
  }
  open.sort(compareOpenReminders);
  completed.sort(compareCompletedReminders);
  return { open, completed };
}

export type ReminderView = {
  id: string;
  kind: ReminderKind;
  title: string;
  dueAt: string;
  dueLabel: string;
  overdue: boolean;
  completedAt: string | null;
  completedLabel: string | null;
  jobId: string | null;
  jobLabel: string | null;
  autoCreated: boolean;
};

export function presentReminder(
  row: {
    id: string;
    kind: ReminderKind;
    title: string;
    dueAt: Date;
    completedAt: Date | null;
    jobId: string | null;
    jobTitle: string | null;
    jobCompany: string | null;
    /** Job deadline for an automatic deadline reminder. Null for every other kind. */
    jobDeadline?: Date | null;
    autoCreated: boolean;
  },
  now: Date,
  timeZone: string,
): ReminderView {
  const custom = row.kind === "CUSTOM";
  const deadline =
    row.kind === "DEADLINE" && row.autoCreated && row.jobDeadline
      ? formatDeadlineDate(row.jobDeadline)
      : null;
  const today = calendarDateInTimeZone(now, timeZone);
  const daysLeft = deadline ? daysUntilDeadline(deadline, today) : null;
  return {
    id: row.id,
    kind: row.kind,
    title:
      row.kind === "DEADLINE" && row.autoCreated
        ? deadlineReminderTitle(row.jobCompany ?? "")
        : row.title,
    dueAt: deadline ? `${deadline}T00:00:00.000Z` : row.dueAt.toISOString(),
    dueLabel: deadline ? formatDeadlineLabel(deadline) : formatEventWhen(row.dueAt, timeZone, custom),
    overdue:
      row.completedAt === null &&
      (deadline ? daysLeft !== null && daysLeft < 0 : row.dueAt.getTime() < now.getTime()),
    completedAt: row.completedAt?.toISOString() ?? null,
    completedLabel: row.completedAt
      ? formatEventWhen(row.completedAt, timeZone, false)
      : null,
    jobId: row.jobId,
    jobLabel: jobLabel(row.jobCompany, row.jobTitle),
    autoCreated: row.autoCreated,
  };
}

export type UpcomingInterviewView = {
  id: string;
  jobId: string;
  jobLabel: string;
  round: number;
  kind: InterviewKind;
  whenLabel: string;
  scheduledAt: string;
};

export function presentUpcomingInterview(
  row: {
    id: string;
    round: number;
    kind: InterviewKind;
    scheduledAt: Date;
    jobId: string;
    jobTitle: string;
    jobCompany: string;
  },
  timeZone: string,
): UpcomingInterviewView {
  return {
    id: row.id,
    jobId: row.jobId,
    jobLabel: jobLabel(row.jobCompany, row.jobTitle) ?? row.jobTitle,
    round: row.round,
    kind: row.kind,
    whenLabel: formatInterviewWhen(row.scheduledAt, timeZone),
    scheduledAt: row.scheduledAt.toISOString(),
  };
}

export function compareUpcomingInterviews(
  a: { scheduledAt: Date; id: string },
  b: { scheduledAt: Date; id: string },
): number {
  const byTime = a.scheduledAt.getTime() - b.scheduledAt.getTime();
  if (byTime !== 0) return byTime;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function jobLabel(company: string | null, title: string | null): string | null {
  if (!company || !title) return null;
  return `${company} · ${title}`;
}

function addCalendarDay(iso: string): string {
  if (!isCalendarDate(iso)) return iso;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + 1);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
