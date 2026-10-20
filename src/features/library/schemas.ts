import { z } from "zod";

import { strings } from "@/copy/strings";
import type { FieldErrors } from "@/lib/result";

import { parseResumeDate, resumeDatesInOrder } from "./dates";

const errors = strings.library.profile.errors;

/** Caps for the library profile dialog. See docs/04-DATA-MODEL.md. */
export const PROFILE_LIMITS = {
  fullName: 80,
  headline: 120,
  phone: 40,
  location: 80,
  summary: 2000,
  linkLabel: 40,
  linkUrl: 300,
  links: 5,
} as const;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export const ProfileLink = z.object({
  label: z
    .string()
    .trim()
    .min(1, { error: errors.linkLabel })
    .max(PROFILE_LIMITS.linkLabel, { error: errors.linkLabelLength }),
  url: z
    .string()
    .trim()
    .url({ error: errors.linkUrl })
    .max(PROFILE_LIMITS.linkUrl, { error: errors.linkUrlLength })
    .refine(isHttpUrl, { error: errors.linkUrl }),
});

export const ProfileLinks = z
  .array(ProfileLink)
  .max(PROFILE_LIMITS.links, { error: errors.linksMax });

export type ProfileLink = z.infer<typeof ProfileLink>;

/** Blank text becomes null so the profile card can tell "empty" from whitespace. */
function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, { error: tooLong })
    .transform((value) => (value.length === 0 ? null : value));
}

export const updateProfileSchema = z.object({
  fullName: optionalText(PROFILE_LIMITS.fullName, errors.nameLength),
  headline: optionalText(PROFILE_LIMITS.headline, errors.headlineLength),
  phone: optionalText(PROFILE_LIMITS.phone, errors.phoneLength),
  location: optionalText(PROFILE_LIMITS.location, errors.locationLength),
  summary: optionalText(PROFILE_LIMITS.summary, errors.summaryLength),
  links: ProfileLinks,
});

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileData = z.output<typeof updateProfileSchema>;

/** Map a Zod error onto ActionResult field keys (`links.0.url`, and so on). */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key =
      issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
    const current = fields[key];
    if (current) {
      current.push(issue.message);
    } else {
      fields[key] = [issue.message];
    }
  }
  return fields;
}

export function profileFieldErrors(error: z.ZodError): FieldErrors {
  return zodFieldErrors(error);
}

/** Screen order and the `Entry.kind` enum. */
export const ENTRY_KINDS = [
  "EXPERIENCE",
  "PROJECT",
  "EDUCATION",
  "CERTIFICATION",
  "VOLUNTEER",
  "OTHER",
] as const;

export const EntryKindEnum = z.enum(ENTRY_KINDS);

/** Caps for the library entry dialog. See docs/04-DATA-MODEL.md. */
export const ENTRY_LIMITS = {
  title: 120,
  organization: 120,
  location: 80,
  url: 300,
} as const;

const entryErrors = strings.library.entries.errors;

function resumeDateField() {
  return z
    .string()
    .trim()
    .refine((value) => value.length === 0 || parseResumeDate(value) !== null, {
      error: entryErrors.date,
    })
    .transform((value) => (value.length === 0 ? null : value));
}

function optionalUrl() {
  return z
    .string()
    .trim()
    .max(ENTRY_LIMITS.url, { error: entryErrors.urlLength })
    .transform((value) => (value.length === 0 ? null : value))
    .refine((value) => value === null || isHttpUrl(value), {
      error: entryErrors.url,
    });
}

const entryFormFields = {
  title: z
    .string()
    .trim()
    .min(1, { error: entryErrors.title })
    .max(ENTRY_LIMITS.title, { error: entryErrors.titleLength }),
  organization: optionalText(
    ENTRY_LIMITS.organization,
    entryErrors.organizationLength,
  ),
  location: optionalText(ENTRY_LIMITS.location, entryErrors.locationLength),
  url: optionalUrl(),
  startDate: resumeDateField(),
  endDate: resumeDateField(),
  isCurrent: z.boolean(),
};

type DatedEntry = {
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
};

function finishEntryForm<T extends DatedEntry>(schema: z.ZodType<T>) {
  return schema
    .refine(
      (data) =>
        resumeDatesInOrder(
          data.startDate,
          data.isCurrent ? null : data.endDate,
        ),
      { error: entryErrors.dateOrder, path: ["endDate"] },
    )
    .transform((data) => ({
      ...data,
      endDate: data.isCurrent ? null : data.endDate,
    }));
}

export const createEntrySchema = finishEntryForm(
  z.object({
    kind: EntryKindEnum,
    ...entryFormFields,
  }),
);

export const updateEntrySchema = finishEntryForm(
  z.object({
    id: z.uuid(),
    ...entryFormFields,
  }),
);

export const deleteEntrySchema = z.object({
  id: z.uuid(),
});

export const reorderEntrySchema = z.object({
  id: z.uuid(),
  direction: z.enum(["up", "down"]),
});

/** Library bullet text. See docs/04-DATA-MODEL.md. */
export const BULLET_LIMITS = {
  text: 400,
} as const;

const bulletErrors = strings.library.bullets.errors;

/**
 * Trimmed, required, and capped. Quotes and angle brackets stay as text.
 * Unknown keys (including a client-supplied userId) are stripped.
 */
export const bulletTextSchema = z
  .string()
  .trim()
  .min(1, { error: bulletErrors.text })
  .max(BULLET_LIMITS.text, { error: bulletErrors.textLength });

export const createBulletSchema = z.object({
  entryId: z.uuid(),
  text: bulletTextSchema,
});

export const updateBulletSchema = z.object({
  id: z.uuid(),
  text: bulletTextSchema,
});

export const deleteBulletSchema = z.object({
  id: z.uuid(),
});

export const reorderBulletSchema = z.object({
  id: z.uuid(),
  direction: z.enum(["up", "down"]),
});

/** Library skill name and category. Name cap matches import (drop over 50). */
export const SKILL_LIMITS = {
  name: 50,
  category: 40,
} as const;

const skillErrors = strings.library.skills.errors;

export const skillNameSchema = z
  .string()
  .trim()
  .min(1, { error: skillErrors.name })
  .max(SKILL_LIMITS.name, { error: skillErrors.nameLength });

/** Blank becomes null. A case-insensitive match to an existing category is applied later. */
export const skillCategorySchema = z
  .string()
  .trim()
  .max(SKILL_LIMITS.category, { error: skillErrors.categoryLength })
  .transform((value) => (value.length === 0 ? null : value));

export const createSkillSchema = z.object({
  name: skillNameSchema,
  category: skillCategorySchema,
});

export const updateSkillSchema = z.object({
  id: z.uuid(),
  name: skillNameSchema,
  category: skillCategorySchema,
});

export const deleteSkillSchema = z.object({
  id: z.uuid(),
});

export const reorderSkillSchema = z.object({
  id: z.uuid(),
  direction: z.enum(["up", "down"]),
});

/** Frozen library facts stored on a tailored resume. See docs/04-DATA-MODEL.md. */
export const LibrarySnapshot = z.object({
  takenAt: z.string(),
  profile: z.object({
    fullName: z.string().nullable(),
    headline: z.string().nullable(),
    email: z.string(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    links: ProfileLinks,
    summary: z.string().nullable(),
  }),
  entries: z.array(
    z.object({
      ref: z.string(),
      id: z.string(),
      kind: EntryKindEnum,
      title: z.string(),
      organization: z.string().nullable(),
      location: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      isCurrent: z.boolean(),
      url: z.string().nullable(),
      bullets: z.array(
        z.object({
          ref: z.string(),
          id: z.string(),
          text: z.string(),
        }),
      ),
    }),
  ),
  skills: z.array(
    z.object({
      ref: z.string(),
      id: z.string(),
      name: z.string(),
      category: z.string().nullable(),
    }),
  ),
});

export type LibrarySnapshot = z.infer<typeof LibrarySnapshot>;

export type CreateEntryInput = z.input<typeof createEntrySchema>;
export type UpdateEntryInput = z.input<typeof updateEntrySchema>;
