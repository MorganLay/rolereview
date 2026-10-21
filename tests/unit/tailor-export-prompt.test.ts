import { describe, expect, it } from "vitest";

import {
  isFirstExportHeader,
  shouldPromptMoveToApplied,
} from "@/features/tailor/export-prompt";

const STATUSES = [
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "NO_RESPONSE",
] as const;

describe("shouldPromptMoveToApplied", () => {
  it("prompts only on the first export of a Saved job", () => {
    expect(shouldPromptMoveToApplied("SAVED", true)).toBe(true);
    expect(shouldPromptMoveToApplied("SAVED", false)).toBe(false);
    for (const status of STATUSES) {
      if (status === "SAVED") continue;
      expect(shouldPromptMoveToApplied(status, true)).toBe(false);
      expect(shouldPromptMoveToApplied(status, false)).toBe(false);
    }
    expect(shouldPromptMoveToApplied("", true)).toBe(false);
  });
});

describe("isFirstExportHeader", () => {
  it("accepts only the first-export flag", () => {
    expect(isFirstExportHeader("1")).toBe(true);
    expect(isFirstExportHeader("0")).toBe(false);
    expect(isFirstExportHeader(null)).toBe(false);
    expect(isFirstExportHeader("true")).toBe(false);
  });
});
