import type { JobEventType, JobStatus } from "@/generated/prisma/enums";
import { calendarDateInTimeZone, isCalendarDate } from "@/features/jobs/dates";

/** Types a person can add or edit. Everything else is written by the app. */
export const MANUAL_EVENT_TYPES = [
  "FOLLOW_UP_SENT",
  "CALL",
  "EMAIL",
  "NOTE",
  "OTHER",
] as const;

export type ManualEventType = (typeof MANUAL_EVENT_TYPES)[number];

const MANUAL_TYPES: ReadonlySet<string> = new Set(MANUAL_EVENT_TYPES);

export function isManualEventType(type: string): type is ManualEventType {
  return MANUAL_TYPES.has(type);
}

export type TimelineSortKey = {
  occurredAt: Date;
  createdAt: Date;
  id: string;
};

/** Newest occurredAt first. The same instant uses the later createdAt, then id. */
export function compareTimelineEvents(a: TimelineSortKey, b: TimelineSortKey): number {
  const byOccurred = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (byOccurred !== 0) return byOccurred;
  const byCreated = b.createdAt.getTime() - a.createdAt.getTime();
  if (byCreated !== 0) return byCreated;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function visibleTimelineEvents<T extends { manual: boolean }>(
  events: readonly T[],
  hideAuto: boolean,
): T[] {
  if (!hideAuto) return [...events];
  return events.filter((event) => event.manual);
}

export type TimelineEventView = {
  id: string;
  type: JobEventType;
  manual: boolean;
  fromStatus: JobStatus | null;
  toStatus: JobStatus | null;
  details: string | null;
  occurredAt: string;
  /** Calendar date in the user's timezone, for the edit form. */
  date: string;
  whenLabel: string;
  contactId: string | null;
  contactName: string | null;
};

/**
 * Noon on a calendar date in an IANA timezone, as a UTC instant.
 * An unknown zone uses noon UTC. `isoDate` must already be a real calendar date.
 */
export function manualEventInstant(isoDate: string, timeZone: string): Date {
  if (!isCalendarDate(isoDate)) {
    throw new Error("Event date must be YYYY-MM-DD.");
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error("Event date must be YYYY-MM-DD.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcNoon = Date.UTC(year, month - 1, day, 12, 0, 0);
  const zone = timeZone.trim();
  if (!zone) return new Date(utcNoon);
  const offset = zoneOffsetMs(new Date(utcNoon), zone);
  if (offset === null) return new Date(utcNoon);
  let instant = utcNoon - offset;
  const settled = zoneOffsetMs(new Date(instant), zone);
  if (settled !== null && settled !== offset) {
    instant = utcNoon - settled;
  }
  return new Date(instant);
}

/** Date only for a manual entry. Date and time for an automatic one. */
export function formatEventWhen(
  occurredAt: Date,
  timeZone: string,
  manual: boolean,
): string {
  const formatted = formatInZone(occurredAt, timeZone, manual);
  if (formatted) return formatted;
  return formatInZone(occurredAt, "UTC", manual) ?? occurredAt.toISOString();
}

export function presentTimelineEvent(
  row: {
    id: string;
    type: JobEventType;
    fromStatus: JobStatus | null;
    toStatus: JobStatus | null;
    details: string | null;
    occurredAt: Date;
    contactId?: string | null;
    contactName?: string | null;
  },
  timeZone: string,
): TimelineEventView {
  const manual = isManualEventType(row.type);
  return {
    id: row.id,
    type: row.type,
    manual,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    details: row.details,
    occurredAt: row.occurredAt.toISOString(),
    date: calendarDateInTimeZone(row.occurredAt, timeZone),
    whenLabel: formatEventWhen(row.occurredAt, timeZone, manual),
    contactId: row.contactId ?? null,
    contactName: row.contactName ?? null,
  };
}

function formatInZone(occurredAt: Date, timeZone: string, manual: boolean): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(manual ? {} : { hour: "numeric", minute: "2-digit" }),
    }).format(occurredAt);
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
