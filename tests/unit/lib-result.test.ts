import { describe, expect, it } from "vitest";

import {
  ERROR_CODES,
  fail,
  ok,
  type ActionResult,
  type ErrorCode,
} from "@/lib/result";

describe("ERROR_CODES", () => {
  it("is the closed set from the architecture docs", () => {
    expect([...ERROR_CODES]).toEqual([
      "VALIDATION",
      "NOT_FOUND",
      "UNAUTHENTICATED",
      "QUOTA_EXCEEDED",
      "PRO_REQUIRED",
      "AI_FAILED",
      "CONFLICT",
      "RATE_LIMITED",
      "CAPTCHA_FAILED",
      "INTERNAL",
    ]);
  });
});

describe("ok", () => {
  it("wraps data in a success result", () => {
    const result: ActionResult<{ id: string }> = ok({ id: "abc" });
    expect(result).toEqual({ ok: true, data: { id: "abc" } });
  });

  it("allows void-like payloads", () => {
    expect(ok(null)).toEqual({ ok: true, data: null });
    expect(ok(undefined)).toEqual({ ok: true, data: undefined });
  });
});

describe("fail", () => {
  it.each(ERROR_CODES)("returns failure for %s without fields", (code) => {
    const result = fail(code);
    expect(result).toEqual({ ok: false, error: { code } });
    expect(result.error.fields).toBeUndefined();
  });

  it("includes field errors when provided", () => {
    const fields = { email: ["Required"], title: undefined };
    const result = fail("VALIDATION", fields);
    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION", fields },
    });
  });

  it("accepts empty field-error maps", () => {
    expect(fail("VALIDATION", {})).toEqual({
      ok: false,
      error: { code: "VALIDATION", fields: {} },
    });
  });

  it("narrows ErrorCode to the closed set", () => {
    const code: ErrorCode = "NOT_FOUND";
    expect(fail(code).error.code).toBe("NOT_FOUND");
  });
});
