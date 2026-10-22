import { describe, expect, it } from "vitest";

import {
  joinNewsletterSchema,
  NEWSLETTER_CONSENT_TEXT,
} from "@/features/growth/leads/schemas";

describe("joinNewsletterSchema", () => {
  const valid = {
    email: "  Alex@Example.com ",
    marketingConsent: true as const,
    turnstileToken: "token",
    consentText: NEWSLETTER_CONSENT_TEXT,
  };

  it("lowercases the email and keeps the exact consent wording", () => {
    const parsed = joinNewsletterSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("alex@example.com");
      expect(parsed.data.consentText).toBe(NEWSLETTER_CONSENT_TEXT);
    }
  });

  it("refuses an unticked checkbox, a missing captcha, and rewritten consent text", () => {
    expect(joinNewsletterSchema.safeParse({ ...valid, marketingConsent: false }).success).toBe(
      false,
    );
    expect(joinNewsletterSchema.safeParse({ ...valid, turnstileToken: "" }).success).toBe(false);
    expect(
      joinNewsletterSchema.safeParse({ ...valid, consentText: "Email me sometimes." }).success,
    ).toBe(false);
  });
});
