import { describe, expect, it } from "vitest";

import {
  MAGIC_LINK_IP_DAILY_LIMIT,
  magicLinkIpBlocked,
} from "@/features/auth/magic-link";
import {
  isPublicLeadLimited,
  PUBLIC_LEAD_DAILY_LIMIT,
} from "@/features/growth/leads/limit";
import { isDailyIpLimited } from "@/lib/ip-limit";

describe("isDailyIpLimited", () => {
  it("blocks at the limit and allows below it", () => {
    expect(isDailyIpLimited(0, 10)).toBe(false);
    expect(isDailyIpLimited(9, 10)).toBe(false);
    expect(isDailyIpLimited(10, 10)).toBe(true);
    expect(isDailyIpLimited(11, 3)).toBe(true);
  });
});

describe("isPublicLeadLimited", () => {
  it("blocks the eleventh waitlist, newsletter, or report email from one network", () => {
    expect(isPublicLeadLimited(9)).toBe(false);
    expect(isPublicLeadLimited(10)).toBe(true);
    expect(PUBLIC_LEAD_DAILY_LIMIT).toBe(10);
  });
});

describe("magicLinkIpBlocked", () => {
  it("blocks the eleventh magic link from one network", () => {
    expect(magicLinkIpBlocked(9)).toBe(false);
    expect(magicLinkIpBlocked(10)).toBe(true);
    expect(MAGIC_LINK_IP_DAILY_LIMIT).toBe(10);
  });
});
