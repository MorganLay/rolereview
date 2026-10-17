import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/supabase/redirect";

describe("safeRedirectPath", () => {
  it("returns the fallback when next is missing", () => {
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath("")).toBe("/dashboard");
  });

  it("allows same-origin relative paths", () => {
    expect(safeRedirectPath("/library/import")).toBe("/library/import");
    expect(safeRedirectPath("/jobs?view=list")).toBe("/jobs?view=list");
  });

  it("rejects open redirects", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("library")).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeRedirectPath("//x", "/")).toBe("/");
  });
});
