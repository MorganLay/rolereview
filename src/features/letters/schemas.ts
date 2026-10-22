import { z } from "zod";

import { strings } from "@/copy/strings";
import { RESUME_TEMPLATES } from "@/lib/pdf/template";

/** Stored letter caps. docs/04-DATA-MODEL.md → CoverLetterContent. */
export const LETTER_LIMITS = {
  paragraph: 1200,
  greeting: 120,
  closing: 60,
  signature: 80,
  recipientName: 80,
  whyCompany: 600,
} as const;

export const LETTER_TONES = ["professional", "warm", "enthusiastic"] as const;
export const LETTER_LENGTHS = ["short", "standard"] as const;

export const POSTING_REF = "POSTING";
export const WHY_REF = "WHY";

/** Stored options. docs/04-DATA-MODEL.md → CoverLetterOptions. */
export const CoverLetterOptions = z.object({
  tone: z.enum(LETTER_TONES).default("professional"),
  length: z.enum(LETTER_LENGTHS).default("standard"),
  recipientName: z.string().max(LETTER_LIMITS.recipientName).optional(),
  whyCompany: z.string().max(LETTER_LIMITS.whyCompany).optional(),
  resumeId: z.uuid().optional(),
});

/** Write-letter dialog. Blank recipient and reasons are allowed; the action omits them. */
export const writeLetterSchema = z.object({
  jobId: z.uuid(),
  tone: z.enum(LETTER_TONES).default("professional"),
  length: z.enum(LETTER_LENGTHS).default("standard"),
  recipientName: z
    .string()
    .trim()
    .max(LETTER_LIMITS.recipientName, {
      error: strings.jobs.letters.recipientTooLong,
    })
    .optional(),
  whyCompany: z
    .string()
    .trim()
    .max(LETTER_LIMITS.whyCompany, {
      error: strings.jobs.letters.whyTooLong,
    })
    .optional(),
  resumeId: z.uuid().optional(),
});

export const rateLetterSchema = z.object({
  letterId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
});

/**
 * Model shape for COVER_LETTER. Loose on purpose; the guard enforces limits.
 * docs/05-AI.md → COVER_LETTER.
 */
export const LetterOutput = z.object({
  greeting: z.string(),
  paragraphs: z.array(
    z.object({
      text: z.string(),
      sourceRefs: z.array(z.string()),
    }),
  ),
  closing: z.string(),
  requirementIdsAddressed: z.array(z.string()),
});

export const LetterParagraph = z.object({
  id: z.string(),
  text: z.string().max(LETTER_LIMITS.paragraph),
  included: z.boolean(),
  sourceRefs: z.array(z.string()),
  reverted: z.boolean().default(false),
  edited: z.boolean().default(false),
  needsWhy: z.boolean().default(false),
});

export const CoverLetterContent = z.object({
  schemaVersion: z.literal(1),
  greeting: z.string().max(LETTER_LIMITS.greeting),
  paragraphs: z.array(LetterParagraph),
  closing: z.string().max(LETTER_LIMITS.closing),
  signature: z.string().max(LETTER_LIMITS.signature),
  requirementIdsAddressed: z.array(z.string()),
});

export const saveLetterContentSchema = z.object({
  jobId: z.uuid(),
  letterId: z.uuid(),
  content: CoverLetterContent,
});

export const setLetterTemplateSchema = z.object({
  jobId: z.uuid(),
  letterId: z.uuid(),
  templateId: z.enum(RESUME_TEMPLATES),
});

export const markLetterSubmittedSchema = z.object({
  jobId: z.uuid(),
  letterId: z.uuid(),
});

export type CoverLetterOptions = z.infer<typeof CoverLetterOptions>;
export type LetterTone = (typeof LETTER_TONES)[number];
export type LetterLength = (typeof LETTER_LENGTHS)[number];
export type LetterOutput = z.infer<typeof LetterOutput>;
export type LetterParagraph = z.infer<typeof LetterParagraph>;
export type CoverLetterContent = z.infer<typeof CoverLetterContent>;

export const ValidatedLetterParagraph = z.object({
  text: z.string(),
  sourceRefs: z.array(z.string()),
  reverted: z.boolean(),
  needsWhy: z.boolean(),
});

export const ValidatedLetterOutput = z.object({
  paragraphs: z.array(ValidatedLetterParagraph),
  closing: z.string(),
  requirementIdsAddressed: z.array(z.string()),
});

export type ValidatedLetterParagraph = z.infer<typeof ValidatedLetterParagraph>;
export type ValidatedLetterOutput = z.infer<typeof ValidatedLetterOutput>;
