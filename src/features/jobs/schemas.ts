import { z } from "zod";

import { strings } from "@/copy/strings";

import { isCalendarDate } from "./dates";

const errors = strings.jobs.errors;

/** Form bounds. Posting bounds: docs/02-USER-FLOWS.md. Detail caps: docs/04-DATA-MODEL.md. */
export const JOB_LIMITS = {
  postingMin: 200,
  postingMax: 30_000,
  url: 2_000,
  title: 120,
  company: 120,
  location: 80,
  sourceDetail: 120,
  referenceNumber: 80,
  notes: 5_000,
  closeReason: 500,
  salary: 2_147_483_647,
} as const;

/** Sentinel for an optional select that stores null. */
export const EMPTY_CHOICE = "NONE";

export const WORK_MODES = ["ONSITE", "HYBRID", "REMOTE", "UNKNOWN"] as const;
export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
  "CO_OP",
  "OTHER",
] as const;
export const PAY_PERIODS = ["HOUR", "YEAR"] as const;

export const OPEN_JOB_STATUSES = [
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
] as const;

/** Board columns. Closed stacks the four closed statuses. */
export const BOARD_STAGES = [...OPEN_JOB_STATUSES, "CLOSED"] as const;

export type BoardStage = (typeof BOARD_STAGES)[number];

export function isBoardStage(value: string): value is BoardStage {
  return (BOARD_STAGES as readonly string[]).includes(value);
}

export const CLOSED_JOB_STATUSES = [
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "NO_RESPONSE",
] as const;

export const JOB_STATUSES = [
  ...OPEN_JOB_STATUSES,
  ...CLOSED_JOB_STATUSES,
] as const;

export type JobStatusValue = (typeof JOB_STATUSES)[number];

const closedStatuses: ReadonlySet<string> = new Set(CLOSED_JOB_STATUSES);

export function isClosedJobStatus(
  status: string,
): status is (typeof CLOSED_JOB_STATUSES)[number] {
  return closedStatuses.has(status);
}

export function isJobStatus(status: string): status is JobStatusValue {
  return (JOB_STATUSES as readonly string[]).includes(status);
}

export const JOB_SOURCES = [
  "LINKEDIN",
  "INDEED",
  "COMPANY_SITE",
  "JOB_BANK",
  "GC_JOBS",
  "REFERRAL",
  "RECRUITER",
  "NETWORKING",
  "JOB_FAIR",
  "OTHER",
] as const;

export const jobSourceSchema = z.enum(JOB_SOURCES, { error: errors.source });

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export const Requirement = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(["skill", "experience", "education", "certification", "other"]),
  importance: z.enum(["must", "nice"]),
});

export type Requirement = z.infer<typeof Requirement>;

/** Stored `Job.analysis`. docs/04-DATA-MODEL.md. */
export const JobAnalysis = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  seniority: z.enum(["intern", "entry", "mid", "senior", "lead", "unknown"]),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE", "UNKNOWN"]),
  employmentType: z
    .enum([
      "FULL_TIME",
      "PART_TIME",
      "CONTRACT",
      "TEMPORARY",
      "INTERNSHIP",
      "CO_OP",
      "OTHER",
    ])
    .nullable(),
  salary: z
    .object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      currency: z.string().nullable(),
      period: z.enum(["HOUR", "YEAR"]).nullable(),
    })
    .nullable(),
  referenceNumber: z.string().nullable(),
  summary: z.string(),
  requirements: z.array(Requirement),
  keywords: z.array(z.string()),
});

export type JobAnalysis = z.infer<typeof JobAnalysis>;

const optionalHttpUrl = z
  .string()
  .trim()
  .max(JOB_LIMITS.url, { error: errors.urlLength })
  .refine((value) => value.length === 0 || isHttpUrl(value), {
    error: errors.url,
  })
  .transform((value) => (value.length === 0 ? null : value));

const optionalDeadline = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || isCalendarDate(value), {
    error: errors.deadline,
  })
  .transform((value) => (value.length === 0 ? null : value));

function requiredText(max: number, empty: string, tooLong: string) {
  return z.string().trim().min(1, { error: empty }).max(max, { error: tooLong });
}

function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, { error: tooLong })
    .transform((value) => (value.length === 0 ? null : value));
}

function optionalChoice<const T extends readonly [string, ...string[]]>(
  values: T,
  message: string,
) {
  const allowed = new Set<string>(values);
  return z
    .string({ error: message })
    .refine((value) => value === EMPTY_CHOICE || allowed.has(value), {
      error: message,
    })
    .transform((value): T[number] | null =>
      value === EMPTY_CHOICE ? null : (value as T[number]),
    );
}

function salaryAmount() {
  return z
    .string()
    .trim()
    .refine(
      (value) => {
        if (value.length === 0) return true;
        if (!/^\d{1,10}$/.test(value)) return false;
        const amount = Number(value);
        return Number.isSafeInteger(amount) && amount <= JOB_LIMITS.salary;
      },
      { error: errors.salary },
    )
    .transform((value) => (value.length === 0 ? null : Number(value)));
}

const salaryCurrency = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => value.length === 0 || /^[A-Z]{3}$/.test(value), {
    error: errors.currency,
  })
  .transform((value) => (value.length === 0 ? null : value));

const priorityValue = z
  .number({ error: errors.priority })
  .int({ error: errors.priority })
  .min(1, { error: errors.priority })
  .max(5, { error: errors.priority })
  .nullable();

export const createJobSchema = z.object({
  rawText: z
    .string()
    .trim()
    .min(JOB_LIMITS.postingMin, { error: errors.postingShort })
    .max(JOB_LIMITS.postingMax, { error: errors.postingLong }),
  url: optionalHttpUrl,
  deadline: optionalDeadline,
  source: jobSourceSchema.nullable(),
  priority: priorityValue,
});

export type CreateJobData = z.output<typeof createJobSchema>;

export const retryAnalysisSchema = z.object({
  jobId: z.uuid(),
});

export const jobStatusSchema = z.enum(JOB_STATUSES, { error: errors.status });

export const updateJobStatusSchema = z.object({
  jobId: z.uuid(),
  status: jobStatusSchema,
  closeReason: optionalText(JOB_LIMITS.closeReason, errors.closeReasonLength),
});

export const moveJobSchema = z.object({
  jobId: z.uuid(),
  toStatus: jobStatusSchema,
  beforeId: z.uuid().nullable().optional(),
  afterId: z.uuid().nullable().optional(),
  closeReason: optionalText(JOB_LIMITS.closeReason, errors.closeReasonLength).optional(),
});

export type UpdateJobStatusInput = z.input<typeof updateJobStatusSchema>;

export const setJobPrioritySchema = z.object({
  jobId: z.uuid(),
  priority: priorityValue,
});

export const setJobArchivedSchema = z.object({
  jobId: z.uuid(),
  archived: z.boolean(),
});

export const ARCHIVE_JOBS_MAX = 200;

export const archiveJobsSchema = z.object({
  jobIds: z.array(z.uuid()).min(1).max(ARCHIVE_JOBS_MAX),
  archived: z.boolean(),
});

export const deleteJobSchema = z.object({
  jobId: z.uuid(),
});

export const updateJobIdentitySchema = z.object({
  jobId: z.uuid(),
  title: requiredText(JOB_LIMITS.title, errors.title, errors.titleLength),
  company: requiredText(JOB_LIMITS.company, errors.company, errors.companyLength),
  location: optionalText(JOB_LIMITS.location, errors.locationLength),
  url: optionalHttpUrl,
});

export type UpdateJobIdentityInput = z.input<typeof updateJobIdentitySchema>;

export const updateJobDetailsSchema = z
  .object({
    jobId: z.uuid(),
    source: optionalChoice(JOB_SOURCES, errors.source),
    sourceDetail: optionalText(JOB_LIMITS.sourceDetail, errors.sourceDetailLength),
    workMode: z.enum(WORK_MODES, { error: errors.workMode }),
    employmentType: optionalChoice(EMPLOYMENT_TYPES, errors.employment),
    salaryMin: salaryAmount(),
    salaryMax: salaryAmount(),
    salaryCurrency,
    salaryPeriod: optionalChoice(PAY_PERIODS, errors.period),
    referenceNumber: optionalText(
      JOB_LIMITS.referenceNumber,
      errors.referenceLength,
    ),
    deadline: optionalDeadline,
    notes: optionalText(JOB_LIMITS.notes, errors.notesLength),
  })
  .superRefine((value, ctx) => {
    if (
      value.salaryMin !== null &&
      value.salaryMax !== null &&
      value.salaryMin > value.salaryMax
    ) {
      ctx.addIssue({
        code: "custom",
        message: errors.salaryOrder,
        path: ["salaryMax"],
      });
    }
  });

export type UpdateJobDetailsInput = z.input<typeof updateJobDetailsSchema>;
export type UpdateJobDetailsData = z.output<typeof updateJobDetailsSchema>;
