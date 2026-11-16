import { z } from "zod";

export const questionIdSchema = z.object({
  questionId: z.uuid(),
});

export const jobIdSchema = z.object({
  jobId: z.uuid(),
});

export const draftRequestSchema = z.object({
  jobId: z.uuid(),
  followUpRound: z.boolean().optional(),
});

export const saveAnswerSchema = z.object({
  questionId: z.uuid(),
  status: z.enum(["YES", "NOT_YET", "SKIPPED"]),
  detail: z.string().trim().max(2000).optional(),
});

export const followUpSchema = z.object({
  questionId: z.uuid(),
  detail: z.string().trim().min(1).max(2000),
});

export const saveLinesSchema = z.object({
  jobId: z.uuid(),
  lines: z
    .array(
      z.object({
        questionId: z.uuid(),
        text: z.string().trim().min(1).max(400),
        include: z.boolean(),
      }),
    )
    .max(6),
});

export const reviseAnswerSchema = z.object({
  originId: z.uuid(),
  decision: z.enum(["yes", "not_yet"]),
  answer: z.string().trim().max(2000),
});

export const applyRevisionSchema = z.object({
  originId: z.uuid(),
  text: z.string().trim().min(1).max(400),
  answer: z.string().trim().min(1).max(2000),
});
