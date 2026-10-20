import { z } from "zod";

import { strings } from "@/copy/strings";

import { isCalendarDate } from "./dates";

const errors = strings.jobs.errors;

/** Form bounds from docs/02-USER-FLOWS.md → `/jobs/new`. */
export const JOB_LIMITS = {
  postingMin: 200,
  postingMax: 30_000,
  url: 2_000,
} as const;

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

export const createJobSchema = z.object({
  rawText: z
    .string()
    .trim()
    .min(JOB_LIMITS.postingMin, { error: errors.postingShort })
    .max(JOB_LIMITS.postingMax, { error: errors.postingLong }),
  url: z
    .string()
    .trim()
    .max(JOB_LIMITS.url, { error: errors.urlLength })
    .refine((value) => value.length === 0 || isHttpUrl(value), {
      error: errors.url,
    })
    .transform((value) => (value.length === 0 ? null : value)),
  deadline: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || isCalendarDate(value), {
      error: errors.deadline,
    })
    .transform((value) => (value.length === 0 ? null : value)),
  source: jobSourceSchema.nullable(),
  priority: z
    .number({ error: errors.priority })
    .int({ error: errors.priority })
    .min(1, { error: errors.priority })
    .max(5, { error: errors.priority })
    .nullable(),
});

export type CreateJobData = z.output<typeof createJobSchema>;

export const retryAnalysisSchema = z.object({
  jobId: z.uuid(),
});
