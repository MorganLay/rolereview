import { z } from "zod";

export const feedbackKindSchema = z.enum(["BUG", "IDEA", "PRAISE", "OTHER"]);

export const submitFeedbackSchema = z.object({
  kind: feedbackKindSchema,
  message: z.string().trim().min(1).max(5000),
  page: z.string().trim().max(500).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
