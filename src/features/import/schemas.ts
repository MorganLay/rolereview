import { z } from "zod";

import { strings } from "@/copy/strings";

import {
  bulletTextSchema,
  createEntrySchema,
  createSkillSchema,
  EntryKindEnum,
  updateProfileSchema,
} from "../library/schemas";

const errors = strings.library.import.errors;

/** Bounds from docs/05-AI.md → IMPORT, plus the library caps applied after the call. */
export const IMPORT_LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  textMin: 200,
  textMax: 40_000,
  bulletHardMax: 2_000,
  email: 254,
  warningLength: 300,
  warningsMax: 20,
} as const;

export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const extractResumeSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("file"),
    file: z.instanceof(File, { error: errors.fileType }),
  }),
  z.object({
    source: z.literal("text"),
    text: z.string(),
  }),
]);

export type ExtractRequest = z.infer<typeof extractResumeSchema>;

/** FormData from the import form, or a plain object from tests and later UI. */
export function coerceExtractInput(input: unknown): unknown {
  if (typeof FormData === "undefined" || !(input instanceof FormData)) {
    return input;
  }
  const file = input.get("file");
  const text = input.get("text");
  if (file instanceof File && file.size > 0) {
    return { source: "file", file };
  }
  if (typeof text === "string") {
    return { source: "text", text };
  }
  if (file instanceof File) {
    return { source: "file", file };
  }
  return input;
}

const commitBulletSchema = z.object({
  included: z.boolean(),
  text: z.string(),
});

const commitEntrySchema = z.object({
  included: z.boolean(),
  kind: EntryKindEnum,
  title: z.string(),
  organization: z.string(),
  location: z.string(),
  url: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean(),
  bullets: z.array(commitBulletSchema),
});

const commitSkillSchema = z.object({
  included: z.boolean(),
  name: z.string(),
  category: z.string(),
});

const commitProfileSchema = z.object({
  included: z.boolean(),
  fullName: z.string(),
  headline: z.string(),
  phone: z.string(),
  location: z.string(),
  summary: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
});

function addIssues(
  ctx: z.RefinementCtx,
  error: z.ZodError,
  prefix: (string | number)[],
) {
  for (const issue of error.issues) {
    ctx.addIssue({
      code: "custom",
      message: issue.message,
      path: [...prefix, ...issue.path],
    });
  }
}

/**
 * Review payload for `commitImport`. Checked items use the library caps.
 * Unchecked items are ignored, including a bullet still over 400 characters.
 * Email is not a field: the sign-in address is never written from a resume.
 */
export const commitImportSchema = z
  .object({
    mode: z.enum(["append", "replace"]),
    profile: commitProfileSchema,
    entries: z.array(commitEntrySchema),
    skills: z.array(commitSkillSchema),
  })
  .superRefine((value, ctx) => {
    if (value.profile.included) {
      const parsed = updateProfileSchema.safeParse(value.profile);
      if (!parsed.success) addIssues(ctx, parsed.error, ["profile"]);
    }
    value.entries.forEach((entry, index) => {
      if (!entry.included) return;
      const parsed = createEntrySchema.safeParse(entry);
      if (!parsed.success) addIssues(ctx, parsed.error, ["entries", index]);
      entry.bullets.forEach((bullet, bulletIndex) => {
        if (!bullet.included) return;
        const text = bulletTextSchema.safeParse(bullet.text);
        if (!text.success) {
          addIssues(ctx, text.error, [
            "entries",
            index,
            "bullets",
            bulletIndex,
            "text",
          ]);
        }
      });
    });
    value.skills.forEach((skill, index) => {
      if (!skill.included) return;
      const parsed = createSkillSchema.safeParse(skill);
      if (!parsed.success) addIssues(ctx, parsed.error, ["skills", index]);
    });
  });

export type CommitImportData = z.infer<typeof commitImportSchema>;
