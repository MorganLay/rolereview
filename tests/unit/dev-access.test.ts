import { describe, expect, it } from "vitest";

import { devSnapshotsOpen } from "@/features/dev/access";
import { normalizeDevEmail, parseDevLoginArgs } from "@/features/dev/login-args";

const SEED = "11111111-1111-4111-8111-111111111111";

describe("devSnapshotsOpen", () => {
  it("opens for the seed account outside production", () => {
    expect(
      devSnapshotsOpen({ nodeEnv: "development", seedUserId: SEED, userId: SEED }),
    ).toBe(true);
    expect(
      devSnapshotsOpen({ nodeEnv: "test", seedUserId: `  ${SEED}  `, userId: SEED }),
    ).toBe(true);
  });

  it("stays closed in production, for other accounts, and without a seed id", () => {
    expect(
      devSnapshotsOpen({ nodeEnv: "production", seedUserId: SEED, userId: SEED }),
    ).toBe(false);
    expect(
      devSnapshotsOpen({
        nodeEnv: "development",
        seedUserId: SEED,
        userId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBe(false);
    expect(
      devSnapshotsOpen({ nodeEnv: "development", seedUserId: undefined, userId: SEED }),
    ).toBe(false);
    expect(
      devSnapshotsOpen({ nodeEnv: "development", seedUserId: "  ", userId: SEED }),
    ).toBe(false);
  });
});

describe("parseDevLoginArgs", () => {
  it("defaults to localhost and /dev", () => {
    expect(parseDevLoginArgs([])).toEqual({
      email: undefined,
      next: "/dev",
      origin: "http://localhost:3000",
    });
  });

  it("reads an email and flags", () => {
    expect(
      parseDevLoginArgs([
        "You@Example.com",
        "--next",
        "/dashboard",
        "--origin=http://127.0.0.1:3000",
      ]),
    ).toEqual({
      email: "You@Example.com",
      next: "/dashboard",
      origin: "http://127.0.0.1:3000",
    });
  });

  it("rejects a second email, an off-site next, and a bad origin", () => {
    expect(parseDevLoginArgs(["a@example.com", "b@example.com"])).toEqual({
      error: "Pass one email.",
    });
    expect(parseDevLoginArgs(["--next", "https://example.com"])).toEqual({
      error: "--next must be a path on this app.",
    });
    expect(parseDevLoginArgs(["--origin", "not a url"])).toEqual({
      error: "--origin must be an http(s) origin.",
    });
    expect(parseDevLoginArgs(["--nope"])).toEqual({ error: "Unknown option --nope." });
  });
});

describe("normalizeDevEmail", () => {
  it("trims and lowercases a usable address", () => {
    expect(normalizeDevEmail("  You@Example.com ")).toBe("you@example.com");
    expect(normalizeDevEmail("not-an-email")).toBeNull();
  });
});
