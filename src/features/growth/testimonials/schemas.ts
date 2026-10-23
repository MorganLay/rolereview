import { z } from "zod";

import { strings } from "@/copy/strings";

/** Exact wording stored on Testimonial.consentText. */
export const TESTIMONIAL_CONSENT_TEXT = strings.jobs.offer.testimonialConsent;

export const TESTIMONIAL_LIMITS = {
  displayName: 80,
  roleTitle: 120,
  quote: 2_000,
} as const;

export const testimonialSchema = z.object({
  displayName: z.string().trim().min(1).max(TESTIMONIAL_LIMITS.displayName),
  roleTitle: z
    .string()
    .trim()
    .max(TESTIMONIAL_LIMITS.roleTitle)
    .transform((value) => (value.length === 0 ? null : value)),
  quote: z.string().trim().min(1).max(TESTIMONIAL_LIMITS.quote),
  consent: z.literal(true),
});

export type TestimonialInput = z.infer<typeof testimonialSchema>;
