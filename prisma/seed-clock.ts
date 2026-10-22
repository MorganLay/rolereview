/**
 * Instants for the dev seed, relative to "now" in the user's timezone.
 * The dashboard tests check that these instants fill Today, the nudges, and this week.
 */

import { addCalendarDays, weekBounds } from "@/features/dashboard/metrics";
import { calendarDateInTimeZone, deadlineInstant } from "@/features/jobs/dates";
import { zonedDateTimeInstant } from "@/features/tracking/interviews";

export type SeedClock = {
  today: string;
  staleAppliedAt: Date;
  appliedThisWeek: Date;
  responseThisWeek: Date;
  screeningAppliedAt: Date;
  deadline: Date;
  respondBy: Date;
  dueToday: Date;
  dueLater: Date;
  dueFollowUp: Date;
  completedAt: Date;
  interviewSoon: Date;
  interviewPast: Date;
  followUpAt: Date;
  updated: {
    stale: Date;
    rejected: Date;
    accepted: Date;
    saved: Date;
    screening: Date;
    applied: Date;
    interviewing: Date;
    offer: Date;
  };
};

export function seedClock(now: Date, timeZone: string): SeedClock {
  const today = calendarDateInTimeZone(now, timeZone);
  const { start } = weekBounds(now, timeZone);
  return {
    today,
    staleAppliedAt: noon(addCalendarDays(today, -31), timeZone),
    appliedThisWeek: instantInWeek(now, start),
    responseThisWeek: instantInWeek(now, start),
    screeningAppliedAt: noon(addCalendarDays(today, -14), timeZone),
    deadline: deadlineInstant(addCalendarDays(today, 3)),
    respondBy: deadlineInstant(addCalendarDays(today, 2)),
    dueToday: noon(today, timeZone),
    dueLater: noon(addCalendarDays(today, 5), timeZone),
    dueFollowUp: noon(addCalendarDays(today, 7), timeZone),
    completedAt: noon(addCalendarDays(today, -1), timeZone),
    interviewSoon: new Date(now.getTime() + 30 * 60 * 60 * 1000),
    interviewPast: noon(addCalendarDays(today, -5), timeZone),
    followUpAt: noon(addCalendarDays(today, -3), timeZone),
    updated: {
      stale: noon(addCalendarDays(today, -40), timeZone),
      rejected: noon(addCalendarDays(today, -20), timeZone),
      accepted: noon(addCalendarDays(today, -15), timeZone),
      saved: noon(addCalendarDays(today, -4), timeZone),
      screening: noon(addCalendarDays(today, -3), timeZone),
      applied: noon(addCalendarDays(today, -2), timeZone),
      interviewing: noon(addCalendarDays(today, -1), timeZone),
      offer: new Date(now.getTime() - 60 * 60 * 1000),
    },
  };
}

/** A moment inside the current week and not after `now`. */
function instantInWeek(now: Date, weekStart: Date): Date {
  const hourIn = new Date(weekStart.getTime() + 60 * 60 * 1000);
  if (hourIn.getTime() < now.getTime()) return hourIn;
  const elapsed = now.getTime() - weekStart.getTime();
  return new Date(weekStart.getTime() + Math.max(1, elapsed / 2));
}

function noon(iso: string, timeZone: string): Date {
  const at = zonedDateTimeInstant(`${iso}T12:00`, timeZone);
  if (!at) {
    throw new Error("Seed could not place noon in the user's timezone.");
  }
  return at;
}
