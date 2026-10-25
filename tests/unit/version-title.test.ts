import { describe, expect, it } from "vitest";

import {
  nextVersionNumber,
  normalizeVersionLabel,
  versionIsFrozen,
  versionTitle,
} from "@/features/tailor/version";

const CREATED = "2026-04-10T15:00:00.000Z";

describe("versionTitle", () => {
  it("uses a saved label", () => {
    expect(
      versionTitle({
        label: "Sent to hiring manager",
        company: "Civic Studio",
        createdAt: CREATED,
        timeZone: "America/Toronto",
      }),
    ).toBe("Sent to hiring manager");
  });

  it("falls back to company and the created date", () => {
    expect(
      versionTitle({
        label: "  ",
        company: "Civic Studio",
        createdAt: new Date(CREATED),
        timeZone: "America/Toronto",
      }),
    ).toBe("Civic Studio \u2014 Apr 10, 2026");
  });

  it("leaves the date on its own when the company is blank", () => {
    expect(
      versionTitle({
        label: null,
        company: "   ",
        createdAt: CREATED,
        timeZone: "America/Toronto",
      }),
    ).toBe("Apr 10, 2026");
  });

  it("formats the date in the user's timezone", () => {
    expect(
      versionTitle({
        label: null,
        company: "Harbour",
        createdAt: "2026-04-11T03:30:00.000Z",
        timeZone: "America/Toronto",
      }),
    ).toBe("Harbour \u2014 Apr 10, 2026");
  });
});

describe("normalizeVersionLabel", () => {
  it("trims and stores blank as null", () => {
    expect(normalizeVersionLabel("  Sent  ")).toBe("Sent");
    expect(normalizeVersionLabel("   ")).toBeNull();
  });
});

describe("version lock helpers", () => {
  it("freezes only a stamped version and numbers the next copy", () => {
    expect(versionIsFrozen(null)).toBe(false);
    expect(versionIsFrozen(new Date(CREATED))).toBe(true);
    expect(nextVersionNumber(null)).toBe(1);
    expect(nextVersionNumber(2)).toBe(3);
  });
});
