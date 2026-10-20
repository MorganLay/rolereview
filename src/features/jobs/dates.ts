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
