import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import {
  PROFILE_LIMITS,
  ProfileLinks,
  profileFieldErrors,
  updateProfileSchema,
} from "@/features/library/schemas";

const errors = strings.library.profile.errors;

const validProfile = {
  fullName: "  Morgan Lee  ",
  headline: " Product designer ",
  phone: "",
  location: "Toronto, ON",
  summary: "  Designs hiring tools.  ",
  links: [
    { label: "  Portfolio  ", url: "  https://example.com/morgan  " },
  ],
};

describe("updateProfileSchema", () => {
  it("trims text, drops blank optional fields, and trims links", () => {
    const parsed = updateProfileSchema.parse(validProfile);
    expect(parsed).toEqual({
      fullName: "Morgan Lee",
      headline: "Product designer",
      phone: null,
      location: "Toronto, ON",
      summary: "Designs hiring tools.",
      links: [{ label: "Portfolio", url: "https://example.com/morgan" }],
    });
  });

  it("accepts a summary of 2,000 characters and rejects 2,001", () => {
    const atCap = updateProfileSchema.safeParse({
      ...validProfile,
      summary: "a".repeat(PROFILE_LIMITS.summary),
    });
    expect(atCap.success).toBe(true);

    const over = updateProfileSchema.safeParse({
      ...validProfile,
      summary: "a".repeat(PROFILE_LIMITS.summary + 1),
    });
    expect(over.success).toBe(false);
    if (!over.success) {
      expect(profileFieldErrors(over.error).summary).toEqual([
        errors.summaryLength,
      ]);
    }
  });

  it("turns a whitespace-only name into null", () => {
    const parsed = updateProfileSchema.parse({
      ...validProfile,
      fullName: "   ",
    });
    expect(parsed.fullName).toBeNull();
  });
});

describe("ProfileLinks", () => {
  it("accepts http and https and rejects other schemes and a sixth link", () => {
    expect(
      ProfileLinks.safeParse([
        { label: "Site", url: "http://example.com" },
        { label: "Secure", url: "https://example.com/path" },
      ]).success,
    ).toBe(true);

    const javascriptUrl = ProfileLinks.safeParse([
      { label: "Bad", url: "javascript:alert(1)" },
    ]);
    expect(javascriptUrl.success).toBe(false);
    if (!javascriptUrl.success) {
      expect(profileFieldErrors(javascriptUrl.error)["0.url"]).toEqual([
        errors.linkUrl,
      ]);
    }

    const missingProtocol = ProfileLinks.safeParse([
      { label: "Site", url: "example.com" },
    ]);
    expect(missingProtocol.success).toBe(false);

    const six = ProfileLinks.safeParse(
      Array.from({ length: 6 }, (_, index) => ({
        label: `Link ${index}`,
        url: `https://example.com/${index}`,
      })),
    );
    expect(six.success).toBe(false);
    if (!six.success) {
      expect(Object.values(profileFieldErrors(six.error)).flat()).toContain(
        errors.linksMax,
      );
    }
  });

  it("keys a bad link on the profile payload as links.0.url", () => {
    const parsed = updateProfileSchema.safeParse({
      ...validProfile,
      links: [{ label: "Site", url: "javascript:alert(1)" }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(profileFieldErrors(parsed.error)["links.0.url"]).toEqual([
        errors.linkUrl,
      ]);
    }
  });

  it("rejects a blank label", () => {
    const parsed = ProfileLinks.safeParse([{ label: "   ", url: "https://example.com" }]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(profileFieldErrors(parsed.error)["0.label"]).toEqual([
        errors.linkLabel,
      ]);
    }
  });
});
