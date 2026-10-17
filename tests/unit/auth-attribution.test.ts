import { describe, expect, it } from "vitest";

import { attributionFromParsed } from "@/lib/auth/attribution";
import {
  parseAttributionCookie,
  type FirstTouchAttribution,
} from "@/lib/supabase/attribution";

describe("attributionFromParsed", () => {
  it("maps cookie fields onto User create columns", () => {
    const parsed: FirstTouchAttribution = {
      source: "waitlist",
      utmSource: "linkedin",
      utmMedium: "social",
      utmCampaign: "launch",
      ref: "abc12345",
      referrer: "news.ycombinator.com",
    };
    expect(attributionFromParsed(parsed)).toEqual({
      signupSource: "waitlist",
      signupReferrer: "news.ycombinator.com",
      utmSource: "linkedin",
      utmMedium: "social",
      utmCampaign: "launch",
      refCode: "abc12345",
    });
  });

  it("returns nulls when there is no cookie payload", () => {
    expect(attributionFromParsed(null)).toEqual({
      signupSource: null,
      signupReferrer: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      refCode: null,
    });
  });

  it("tolerates partial payloads", () => {
    expect(attributionFromParsed({ ref: "only-ref" })).toEqual({
      signupSource: null,
      signupReferrer: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      refCode: "only-ref",
    });
  });
});

describe("parseAttributionCookie", () => {
  it("round-trips JSON used by the first-touch cookie", () => {
    const raw = JSON.stringify({
      source: "homepage",
      utm_source: "should-ignore-snake",
      utmSource: "twitter",
      ref: "code",
    });
    expect(parseAttributionCookie(raw)).toMatchObject({
      source: "homepage",
      utmSource: "twitter",
      ref: "code",
    });
  });

  it("returns null for garbage", () => {
    expect(parseAttributionCookie(undefined)).toBeNull();
    expect(parseAttributionCookie("{")).toBeNull();
    expect(parseAttributionCookie("null")).toBeNull();
  });
});
