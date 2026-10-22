import { z } from "zod";

import { strings } from "@/copy/strings";
import { isCalendarDate } from "@/features/jobs/dates";
import { zodFieldErrors } from "@/features/library/schemas";

import {
  CONTACT_LIMITS,
  CONTACT_ROLES,
  isHttpUrl,
} from "./contacts";
import { MANUAL_EVENT_TYPES } from "./events";
import {
  INTERVIEW_KINDS,
  INTERVIEW_LIMITS,
  INTERVIEW_OUTCOMES,
  isZonedDateTime,
} from "./interviews";

const errors = strings.jobs.timeline.errors;
const contactErrors = strings.contacts.errors;

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

const timelineContactId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

const timelineFields = {
  jobId: z.uuid(),
  type: manualType,
  date: eventDate,
  details,
  contactId: timelineContactId,
};

function refineTimelineContact(
  data: { type: string; contactId: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.contactId === null) return;
  if (!z.uuid().safeParse(data.contactId).success) {
    ctx.addIssue({ code: "custom", path: ["contactId"], message: errors.contact });
    return;
  }
  if (data.type !== "FOLLOW_UP_SENT") {
    ctx.addIssue({
      code: "custom",
      path: ["contactId"],
      message: errors.contactType,
    });
  }
}

export const createTimelineEventSchema = z
  .object(timelineFields)
  .superRefine(refineTimelineContact);

export const updateTimelineEventSchema = z
  .object({
    ...timelineFields,
    eventId: z.uuid(),
  })
  .superRefine(refineTimelineContact);

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

function optionalEmail() {
  return z
    .string()
    .trim()
    .max(CONTACT_LIMITS.email, { error: contactErrors.emailLength })
    .superRefine((value, ctx) => {
      if (value.length === 0) return;
      if (!z.email().safeParse(value).success) {
        ctx.addIssue({ code: "custom", message: contactErrors.email });
      }
    })
    .transform((value) => (value.length > 0 ? value : null));
}

function optionalHttpUrl() {
  return z
    .string()
    .trim()
    .max(CONTACT_LIMITS.linkedinUrl, { error: contactErrors.linkedinLength })
    .superRefine((value, ctx) => {
      if (value.length === 0) return;
      if (!isHttpUrl(value)) {
        ctx.addIssue({ code: "custom", message: contactErrors.linkedin });
      }
    })
    .transform((value) => (value.length > 0 ? value : null));
}

const contactFields = {
  name: z
    .string()
    .trim()
    .min(1, { error: contactErrors.name })
    .max(CONTACT_LIMITS.name, { error: contactErrors.nameLength }),
  title: blankText(CONTACT_LIMITS.title, contactErrors.titleLength),
  company: blankText(CONTACT_LIMITS.company, contactErrors.companyLength),
  email: optionalEmail(),
  phone: blankText(CONTACT_LIMITS.phone, contactErrors.phoneLength),
  linkedinUrl: optionalHttpUrl(),
  notes: blankText(CONTACT_LIMITS.notes, contactErrors.notesLength),
};

const contactRole = z.enum(CONTACT_ROLES, { error: contactErrors.role });

export const createContactSchema = z.object({
  ...contactFields,
  jobId: z.uuid().optional(),
  role: contactRole.optional(),
});

export const updateContactSchema = z.object({
  ...contactFields,
  contactId: z.uuid(),
});

export const deleteContactSchema = z.object({
  contactId: z.uuid(),
});

export const linkJobContactSchema = z.object({
  jobId: z.uuid(),
  contactId: z.uuid(),
  role: contactRole,
});

export const updateJobContactRoleSchema = linkJobContactSchema;

export const unlinkJobContactSchema = z.object({
  jobId: z.uuid(),
  contactId: z.uuid(),
});

export const logOutreachSchema = z.object({
  jobId: z.uuid(),
  contactId: z.uuid(),
  details,
});

export type CreateContactInput = z.input<typeof createContactSchema>;
export type UpdateContactInput = z.input<typeof updateContactSchema>;

export { zodFieldErrors };
