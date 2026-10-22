import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  clientIpFromHeaders,
  hashIp,
  utcDayStamp,
} from "@/lib/iphash";

describe("utcDayStamp", () => {
  it("uses the UTC calendar date", () => {
    expect(utcDayStamp(new Date("2026-10-22T23:30:00.000Z"))).toBe("2026-10-22");
    expect(utcDayStamp(new Date("2026-10-23T00:00:00.000Z"))).toBe("2026-10-23");
  });
});

describe("hashIp", () => {
  it("hashes ip + salt + day with no separators", () => {
    const digest = hashIp("203.0.113.10", "salt-value", "2026-10-22");
    expect(digest).toBe(
      createHash("sha256")
        .update("203.0.113.10salt-value2026-10-22")
        .digest("hex"),
    );
    expect(digest).toHaveLength(64);
  });

  it("changes when the day rolls over", () => {
    const salt = "a-long-enough-salt-value-here";
    const today = hashIp("203.0.113.10", salt, "2026-10-22");
    const tomorrow = hashIp("203.0.113.10", salt, "2026-10-23");
    expect(today).not.toBe(tomorrow);
  });

  it("changes when the salt changes", () => {
    expect(hashIp("203.0.113.10", "salt-a", "2026-10-22")).not.toBe(
      hashIp("203.0.113.10", "salt-b", "2026-10-22"),
    );
  });
});

describe("clientIpFromHeaders", () => {
  it("uses the first x-forwarded-for hop", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.10, 198.51.100.1 ",
      "x-real-ip": "198.51.100.9",
    });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.9" });
    expect(clientIpFromHeaders(headers)).toBe("198.51.100.9");
  });

  it("returns null when neither header is set", () => {
    expect(clientIpFromHeaders(new Headers())).toBeNull();
  });
});
