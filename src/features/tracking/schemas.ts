import { z } from "zod";

import { strings } from "@/copy/strings";
import { isCalendarDate } from "@/features/jobs/dates";
import { zodFieldErrors } from "@/features/library/schemas";

import { MANUAL_EVENT_TYPES } from "./events";

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

export { zodFieldErrors };
