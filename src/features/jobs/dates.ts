/**
 * Calendar dates for job deadlines. Stored as UTC midnight so
 * "deadline − 3 days" does not shift with the server's timezone.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` in 1900–2099 that is a real calendar day. */
export function isCalendarDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2099) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** UTC midnight on a date `isCalendarDate` already accepted. */
export function deadlineInstant(isoDate: string): Date {
  const match = DATE_RE.exec(isoDate);
  if (!match) {
    throw new Error("Deadline must be YYYY-MM-DD.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Reminder due at the deadline instant minus 3 calendar days. */
export function deadlineReminderDue(deadline: Date): Date {
  const due = new Date(deadline.getTime());
  due.setUTCDate(due.getUTCDate() - 3);
  return due;
}

/** Whole calendar days from `today` to `deadline`. Both must be real `YYYY-MM-DD` dates. */
export function daysUntilDeadline(deadline: string, today: string): number | null {
  const due = utcDayNumber(deadline);
  const start = utcDayNumber(today);
  if (due === null || start === null) return null;
  return due - start;
}

export type DeadlineUrgency = "past" | "soon" | "later";

/** Soon is today through three days ahead. Earlier is past. */
export function deadlineUrgency(
  deadline: string,
  today: string,
): DeadlineUrgency | null {
  const days = daysUntilDeadline(deadline, today);
  if (days === null) return null;
  if (days < 0) return "past";
  if (days <= 3) return "soon";
  return "later";
}

/**
 * Calendar date in an IANA timezone. An unknown zone uses the UTC date.
 */
export function calendarDateInTimeZone(now: Date, timeZone: string): string {
  const zoned = formatCalendarParts(now, timeZone);
  if (zoned) return zoned;
  return formatCalendarParts(now, "UTC") ?? "1970-01-01";
}

function utcDayNumber(iso: string): number | null {
  if (!isCalendarDate(iso)) return null;
  const match = DATE_RE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatCalendarParts(now: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) return null;
    const iso = `${year}-${month}-${day}`;
    return isCalendarDate(iso) ? iso : null;
  } catch {
    return null;
  }
}

/** `YYYY-MM-DD` for a deadline stored as UTC midnight. */
export function formatDeadlineDate(deadline: Date): string {
  const year = deadline.getUTCFullYear();
  const month = String(deadline.getUTCMonth() + 1).padStart(2, "0");
  const day = String(deadline.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type DeadlineReminderPlan =
  | { action: "keep" }
  | { action: "upsert"; dueAt: Date }
  | { action: "dismiss" };

/**
 * What to do with the open automatic deadline reminder when the date changes.
 * The same instant leaves it alone. Completed and dismissed reminders are not in this plan.
 */
export function planDeadlineReminder(
  previous: Date | null,
  next: Date | null,
): DeadlineReminderPlan {
  const sameInstant =
    previous === null
      ? next === null
      : next !== null && previous.getTime() === next.getTime();
  if (sameInstant) return { action: "keep" };
  if (next) return { action: "upsert", dueAt: deadlineReminderDue(next) };
  return { action: "dismiss" };
}
