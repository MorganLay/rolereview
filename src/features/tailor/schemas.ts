import { z } from "zod";

import { strings } from "@/copy/strings";
import { EntryKindEnum } from "@/features/library/schemas";
import { VERSION_LABEL_MAX } from "@/features/tailor/version";
import { RESUME_TEMPLATES } from "@/lib/pdf/template";

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

const ModelVerdict = z.enum(["met", "partial", "missing"]);

/** Saved on a match report. `unassessed` is written by the guard, not the model. */
export const StoredVerdict = z.enum(["met", "partial", "missing", "unassessed"]);

export const NOT_ASSESSED_NOTE = "Not assessed.";

/** Model shape for TAILOR. Loose on purpose; the guard enforces limits. docs/05-AI.md. */
export const TailorBullet = z.object({
  sourceRefs: z.array(z.string()),
  text: z.string(),
});

/** Resume-level plan from the model. Stored, not shown. It can overstate. */
export const EditorialPlan = z.object({
  narrative: z.string(),
  priorities: z.array(z.string()),
  gaps: z.array(z.string()),
});

export const TailorSkillGroup = z.object({
  category: z.string().nullable(),
  refs: z.array(z.string()),
});

export const RequirementMatch = z.object({
  requirementId: z.string(),
  verdict: ModelVerdict,
  evidenceRefs: z.array(z.string()),
  note: z.string(),
});

/** Guard output. The model schema stays met, partial, or missing. */
export const GuardRequirementMatch = RequirementMatch.extend({
  verdict: StoredVerdict,
});

export const TailorOutput = z.object({
  summary: z.string(),
  plan: EditorialPlan.optional(),
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
  requirementMatches: z.array(GuardRequirementMatch),
});

export const ContentBullet = z.object({
  id: z.string(),
  text: z.string().max(RESUME_LIMITS.bullet),
  included: z.boolean(),
  sourceRefs: z.array(z.string()),
  reverted: z.boolean().default(false),
  edited: z.boolean().default(false),
  /** Cited source wording. A combined line joins its sources until restore splits them. */
  originalText: z.string().max(RESUME_LIMITS.bullet).nullable().default(null),
  /** Grounded tailored wording, kept after the user restores the original. */
  suggestion: z.string().max(RESUME_LIMITS.bullet).nullable().default(null),
  /** Why the suggestion differs from the library bullet. */
  suggestionNote: z.string().max(RESUME_LIMITS.note).nullable().default(null),
  /** What the edit changed. Null when the line was not rewritten, or the note was vague. */
  changeWhat: z.string().max(RESUME_LIMITS.note).nullable().default(null),
  /** Requirement ids that motivated a rewrite. Empty on older resumes. */
  requirementIds: z.array(z.string()).default([]),
  /** Stable library bullet ids. Empty on resumes saved before wording variants. */
  sourceIds: z.array(z.string()).optional(),
});

export const ContentEntry = z.object({
  ref: z.string(),
  kind: EntryKindEnum,
  included: z.boolean(),
  /** Stable library entry id. Absent on resumes saved before wording variants. */
  entryId: z.string().optional(),
  bullets: z.array(ContentBullet),
});

export const ResumeSkillGroup = z.object({
  category: z.string().nullable(),
  names: z.array(z.string()),
});

/** Why a composed resume included, excluded, or reordered something. Refs only. */
export const RESUME_REVIEW_CODES = [
  "CURRENT_ROLE_OMITTED",
  "DUPLICATE_CONSOLIDATED",
  "ORDER_ADJUSTED",
  "SECTION_ORDER",
  "BULLET_PREFERENCE",
  "CONTACT_SELECTED",
  "CONTACT_EXCLUDED",
  "ENTRY_INCLUDED",
  "ENTRY_EXCLUDED",
  "SKILL_EVIDENCE",
] as const;

export const ResumeReviewItem = z.object({
  code: z.enum(RESUME_REVIEW_CODES),
  severity: z.enum(["warning", "note"]),
  ref: z.string().max(80),
  reason: z.string().max(80),
});

export const ResumeContact = z.object({
  label: z.string().max(40),
  url: z.string().max(300),
  kind: z.enum(["github", "linkedin", "portfolio", "other"]),
  reason: z.string().max(80),
});

export const ResumeContent = z.object({
  schemaVersion: z.literal(1),
  summary: z.object({
    text: z.string().max(RESUME_LIMITS.summary),
    included: z.boolean(),
  }),
  entries: z.array(ContentEntry),
  skills: z.array(ResumeSkillGroup),
  /** Omitted on resumes saved before composition. Experience, Projects, Education, and the rest. */
  sectionOrder: z.array(EntryKindEnum).optional(),
  /** Omitted on older resumes, which keep every profile link. */
  contacts: z.array(ResumeContact).max(8).optional(),
  /** Selection, exclusion, and ordering notes. Omitted on older resumes. */
  review: z.array(ResumeReviewItem).max(80).optional(),
});

export const saveResumeContentSchema = z.object({
  jobId: z.uuid(),
  resumeId: z.uuid(),
  content: ResumeContent,
});

export const setResumeTemplateSchema = z.object({
  jobId: z.uuid(),
  resumeId: z.uuid(),
  templateId: z.enum(RESUME_TEMPLATES),
});

export const markResumeSubmittedSchema = z.object({
  jobId: z.uuid(),
  resumeId: z.uuid(),
});

export const setResumeLabelSchema = z.object({
  jobId: z.uuid(),
  resumeId: z.uuid(),
  label: z.string().trim().max(VERSION_LABEL_MAX, {
    error: strings.jobs.workspace.labelTooLong,
  }),
});

export const RequirementVerdict = z
  .object({
    requirementId: z.string(),
    verdict: StoredVerdict,
    evidenceRefs: z.array(z.string()),
    note: z.string().max(RESUME_LIMITS.note),
  })
  .transform((row) =>
    row.verdict === "missing" && row.note === NOT_ASSESSED_NOTE
      ? { ...row, verdict: "unassessed" as const }
      : row,
  );

export const MatchReport = z.object({
  verdicts: z.array(RequirementVerdict),
  score: z.number().int().min(0).max(100).nullable(),
});

export type EditorialPlan = z.infer<typeof EditorialPlan>;
export type TailorBullet = z.infer<typeof TailorBullet>;
export type TailorSkillGroup = z.infer<typeof TailorSkillGroup>;
export type StoredVerdict = z.infer<typeof StoredVerdict>;
export type RequirementMatch = z.infer<typeof RequirementMatch>;
export type GuardRequirementMatch = z.infer<typeof GuardRequirementMatch>;
export type TailorOutput = z.infer<typeof TailorOutput>;
export type ValidatedBullet = z.infer<typeof ValidatedBullet>;
export type ValidatedTailorOutput = z.infer<typeof ValidatedTailorOutput>;
export type ContentBullet = z.infer<typeof ContentBullet>;
export type ContentEntry = z.infer<typeof ContentEntry>;
export type ResumeContent = z.infer<typeof ResumeContent>;
export type ResumeReviewItem = z.infer<typeof ResumeReviewItem>;
export type ResumeContact = z.infer<typeof ResumeContact>;
export type RequirementVerdict = z.infer<typeof RequirementVerdict>;
export type MatchReport = z.infer<typeof MatchReport>;
