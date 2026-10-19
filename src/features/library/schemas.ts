import { z } from "zod";

import { strings } from "@/copy/strings";
import type { FieldErrors } from "@/lib/result";

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
export function profileFieldErrors(error: z.ZodError): FieldErrors {
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
