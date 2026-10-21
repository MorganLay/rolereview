import { z } from "zod";

import { strings } from "@/copy/strings";
import { EntryKindEnum } from "@/features/library/schemas";

/** Stored resume caps. docs/04-DATA-MODEL.md. */
export const RESUME_LIMITS = {
  bullet: 400,
  summary: 800,
  note: 200,
} as const;

/** Optional emphasis on the tailor dialog. docs/04-DATA-MODEL.md → TailorOptions. */
export const EMPHASIS_MAX = 200;

export const TailorOptions = z.object({
  length: z.union([z.literal(1), z.literal(2)]).default(1),
  emphasis: z
    .string()
    .trim()
    .max(EMPHASIS_MAX, { error: strings.jobs.documents.emphasisTooLong })
    .optional(),
  targetProfileId: z.uuid().optional(),
});

export const tailorResumeSchema = z.object({
  jobId: z.uuid(),
  length: z.union([z.literal(1), z.literal(2)]).default(1),
  emphasis: z
    .string()
    .trim()
    .max(EMPHASIS_MAX, { error: strings.jobs.documents.emphasisTooLong })
    .optional(),
});

export const rateResumeSchema = z.object({
  resumeId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
});

export type TailorOptions = z.infer<typeof TailorOptions>;

const Verdict = z.enum(["met", "partial", "missing"]);

/** Model shape for TAILOR. Loose on purpose; the guard enforces limits. docs/05-AI.md. */
export const TailorBullet = z.object({
  sourceRefs: z.array(z.string()),
  text: z.string(),
});

export const TailorSkillGroup = z.object({
  category: z.string().nullable(),
  refs: z.array(z.string()),
});

export const RequirementMatch = z.object({
  requirementId: z.string(),
  verdict: Verdict,
  evidenceRefs: z.array(z.string()),
  note: z.string(),
});

export const TailorOutput = z.object({
  summary: z.string(),
  entries: z.array(
    z.object({
      ref: z.string(),
      bullets: z.array(TailorBullet),
    }),
  ),
  skills: z.array(TailorSkillGroup),
  requirementMatches: z.array(RequirementMatch),
});

export const ValidatedBullet = TailorBullet.extend({
  reverted: z.boolean(),
});

export const ValidatedTailorOutput = TailorOutput.extend({
  entries: z.array(
    z.object({
      ref: z.string(),
      bullets: z.array(ValidatedBullet),
    }),
  ),
});

export const ContentBullet = z.object({
  id: z.string(),
  text: z.string().max(RESUME_LIMITS.bullet),
  included: z.boolean(),
  sourceRefs: z.array(z.string()),
  reverted: z.boolean().default(false),
  edited: z.boolean().default(false),
});

export const ContentEntry = z.object({
  ref: z.string(),
  kind: EntryKindEnum,
  included: z.boolean(),
  bullets: z.array(ContentBullet),
});

export const ResumeSkillGroup = z.object({
  category: z.string().nullable(),
  names: z.array(z.string()),
});

export const ResumeContent = z.object({
  schemaVersion: z.literal(1),
  summary: z.object({
    text: z.string().max(RESUME_LIMITS.summary),
    included: z.boolean(),
  }),
  entries: z.array(ContentEntry),
  skills: z.array(ResumeSkillGroup),
});

export const RequirementVerdict = z.object({
  requirementId: z.string(),
  verdict: Verdict,
  evidenceRefs: z.array(z.string()),
  note: z.string().max(RESUME_LIMITS.note),
});

export const MatchReport = z.object({
  verdicts: z.array(RequirementVerdict),
  score: z.number().int().min(0).max(100).nullable(),
});

export type TailorBullet = z.infer<typeof TailorBullet>;
export type TailorSkillGroup = z.infer<typeof TailorSkillGroup>;
export type RequirementMatch = z.infer<typeof RequirementMatch>;
export type TailorOutput = z.infer<typeof TailorOutput>;
export type ValidatedBullet = z.infer<typeof ValidatedBullet>;
export type ValidatedTailorOutput = z.infer<typeof ValidatedTailorOutput>;
export type ContentBullet = z.infer<typeof ContentBullet>;
export type ContentEntry = z.infer<typeof ContentEntry>;
export type ResumeContent = z.infer<typeof ResumeContent>;
export type RequirementVerdict = z.infer<typeof RequirementVerdict>;
export type MatchReport = z.infer<typeof MatchReport>;
