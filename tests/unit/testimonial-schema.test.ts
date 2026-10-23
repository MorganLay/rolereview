import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import {
  TESTIMONIAL_CONSENT_TEXT,
  TESTIMONIAL_LIMITS,
  testimonialSchema,
} from "@/features/growth/testimonials/schemas";

const valid = {
  displayName: "Priya S.",
  roleTitle: "Junior Data Analyst",
  quote: "It kept the facts I actually had.",
  consent: true as const,
};

describe("testimonialSchema", () => {
  it("stores a blank role as null and keeps the consent wording", () => {
    expect(TESTIMONIAL_CONSENT_TEXT).toBe(strings.jobs.offer.testimonialConsent);
    const parsed = testimonialSchema.safeParse({ ...valid, roleTitle: "  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.roleTitle).toBeNull();
  });

  it("rejects a missing consent tick, an empty note, and over-long fields", () => {
    expect(testimonialSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...valid, quote: "   " }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...valid, displayName: "  " }).success).toBe(false);
    expect(
      testimonialSchema.safeParse({
        ...valid,
        displayName: "A".repeat(TESTIMONIAL_LIMITS.displayName + 1),
      }).success,
    ).toBe(false);
    expect(
      testimonialSchema.safeParse({
        ...valid,
        roleTitle: "R".repeat(TESTIMONIAL_LIMITS.roleTitle + 1),
      }).success,
    ).toBe(false);
    expect(
      testimonialSchema.safeParse({
        ...valid,
        quote: "Q".repeat(TESTIMONIAL_LIMITS.quote + 1),
      }).success,
    ).toBe(false);
  });

  it("accepts a name and quote at the cap", () => {
    const parsed = testimonialSchema.safeParse({
      ...valid,
      displayName: "N".repeat(TESTIMONIAL_LIMITS.displayName),
      quote: "Q".repeat(TESTIMONIAL_LIMITS.quote),
    });
    expect(parsed.success).toBe(true);
  });
});
