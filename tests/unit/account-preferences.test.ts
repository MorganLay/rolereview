import { describe, expect, it } from "vitest";

import { MARKETING_CONSENT_TEXT, isIanaTimeZone, nextMarketingConsent } from "@/features/account/preferences";
import { preferencesSchema } from "@/features/account/schemas";

const NOW = new Date("2026-10-23T07:00:00.000Z");
const EARLIER = new Date("2026-10-01T12:00:00.000Z");

describe("isIanaTimeZone", () => {
  it("accepts a real zone and rejects junk", () => {
    expect(isIanaTimeZone("America/Toronto")).toBe(true);
    expect(isIanaTimeZone("")).toBe(false);
    expect(isIanaTimeZone("Not/AZone")).toBe(false);
    expect(isIanaTimeZone("America/Toronto;drop")).toBe(false);
    expect(isIanaTimeZone("A".repeat(101))).toBe(false);
  });
});

describe("preferencesSchema", () => {
  it("parses a real timezone and the three switches", () => {
    const parsed = preferencesSchema.safeParse({
      timezone: "America/Toronto",
      emailRemindersEnabled: false,
      weeklyDigestEnabled: true,
      marketingConsent: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown timezone", () => {
    const parsed = preferencesSchema.safeParse({
      timezone: "Not/AZone",
      emailRemindersEnabled: true,
      weeklyDigestEnabled: true,
      marketingConsent: false,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("nextMarketingConsent", () => {
  it("clears both fields when the box is unticked", () => {
    expect(
      nextMarketingConsent({
        requested: false,
        existingAt: EARLIER,
        existingText: MARKETING_CONSENT_TEXT,
        now: NOW,
        text: MARKETING_CONSENT_TEXT,
      }),
    ).toEqual({ marketingConsentAt: null, marketingConsentText: null });
  });

  it("stores the timestamp and the exact wording on a new opt-in", () => {
    expect(
      nextMarketingConsent({
        requested: true,
        existingAt: null,
        existingText: null,
        now: NOW,
        text: MARKETING_CONSENT_TEXT,
      }),
    ).toEqual({ marketingConsentAt: NOW, marketingConsentText: MARKETING_CONSENT_TEXT });
  });

  it("keeps the original timestamp when the wording is unchanged", () => {
    expect(
      nextMarketingConsent({
        requested: true,
        existingAt: EARLIER,
        existingText: MARKETING_CONSENT_TEXT,
        now: NOW,
        text: MARKETING_CONSENT_TEXT,
      }),
    ).toEqual({
      marketingConsentAt: EARLIER,
      marketingConsentText: MARKETING_CONSENT_TEXT,
    });
  });
});
