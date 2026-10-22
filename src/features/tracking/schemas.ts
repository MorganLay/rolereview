import { z } from "zod";

import { strings } from "@/copy/strings";
import { isCalendarDate } from "@/features/jobs/dates";
import { zodFieldErrors } from "@/features/library/schemas";

import { MANUAL_EVENT_TYPES } from "./events";
import {
  INTERVIEW_KINDS,
  INTERVIEW_LIMITS,
  INTERVIEW_OUTCOMES,
  isZonedDateTime,
} from "./interviews";

const errors = strings.jobs.timeline.errors;

export const EVENT_LIMITS = {
  details: 2_000,
} as const;

const eventDate = z
  .string()
  .trim()
  .refine(isCalendarDate, { error: errors.date });

const details = z
  .string()
  .trim()
  .min(1, { error: errors.details })
  .max(EVENT_LIMITS.details, { error: errors.detailsLength });

const manualType = z.enum(MANUAL_EVENT_TYPES, { error: errors.type });

export const createTimelineEventSchema = z.object({
  jobId: z.uuid(),
  type: manualType,
  date: eventDate,
  details,
});

export const updateTimelineEventSchema = createTimelineEventSchema.extend({
  eventId: z.uuid(),
});

export type CreateTimelineEventInput = z.input<typeof createTimelineEventSchema>;

const interviewErrors = strings.jobs.interviews.errors;

function blankText(max: number, lengthError: string) {
  return z
    .string()
    .trim()
    .max(max, { error: lengthError })
    .transform((value) => (value.length > 0 ? value : null));
}

const interviewRound = z
  .string()
  .trim()
  .refine((value) => /^\d{1,2}$/.test(value), { error: interviewErrors.round })
  .transform((value) => Number(value))
  .refine(
    (value) =>
      value >= INTERVIEW_LIMITS.roundMin && value <= INTERVIEW_LIMITS.roundMax,
    { error: interviewErrors.round },
  );

const interviewDuration = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{1,3}$/.test(value), {
    error: interviewErrors.duration,
  })
  .transform((value) => (value === "" ? null : Number(value)))
  .refine(
    (value) =>
      value === null ||
      (value >= INTERVIEW_LIMITS.durationMin && value <= INTERVIEW_LIMITS.durationMax),
    { error: interviewErrors.duration },
  );

const interviewScheduledAt = z
  .string()
  .trim()
  .refine((value) => value === "" || isZonedDateTime(value), {
    error: interviewErrors.dateTime,
  });

const interviewFields = {
  jobId: z.uuid(),
  round: interviewRound,
  kind: z.enum(INTERVIEW_KINDS, { error: interviewErrors.kind }),
  scheduledAt: interviewScheduledAt,
  durationMinutes: interviewDuration,
  locationOrLink: blankText(
    INTERVIEW_LIMITS.locationOrLink,
    interviewErrors.locationLength,
  ),
  interviewers: blankText(
    INTERVIEW_LIMITS.interviewers,
    interviewErrors.interviewersLength,
  ),
  prepNotes: blankText(INTERVIEW_LIMITS.prepNotes, interviewErrors.prepNotesLength),
  reflection: blankText(INTERVIEW_LIMITS.reflection, interviewErrors.reflectionLength),
  outcome: z.enum(INTERVIEW_OUTCOMES, { error: interviewErrors.outcome }),
};

export const createInterviewSchema = z.object(interviewFields);

export const updateInterviewSchema = z.object({
  ...interviewFields,
  interviewId: z.uuid(),
});

export const deleteInterviewSchema = z.object({
  jobId: z.uuid(),
  interviewId: z.uuid(),
});

export type CreateInterviewInput = z.input<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.input<typeof updateInterviewSchema>;

export { zodFieldErrors };
