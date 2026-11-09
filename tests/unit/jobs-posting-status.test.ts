import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import { postingStatus } from "@/features/jobs/posting-status";
import { JOB_LIMITS } from "@/features/jobs/schemas";

const copy = strings.jobs;

function line(count: number, note: string): string {
  return `${copy.postingCount(count)} · ${note}`;
}

describe("postingStatus", () => {
  it("shows the count and range before the field is left short", () => {
    expect(postingStatus(0, false)).toEqual({
      text: line(0, copy.postingRange),
      invalid: false,
      live: "",
    });
    expect(postingStatus(80, false)).toEqual({
      text: line(80, copy.postingRange),
      invalid: false,
      live: "",
    });
  });

  it("guides after a short posting is left, without marking it invalid", () => {
    const count = JOB_LIMITS.postingMin - 1;
    expect(postingStatus(count, true)).toEqual({
      text: line(count, copy.errors.postingShort),
      invalid: false,
      live: copy.errors.postingShort,
    });
    expect(postingStatus(0, true).live).toBe("");
  });

  it("keeps a posting inside the range ordinary", () => {
    for (const count of [JOB_LIMITS.postingMin, 1_240, JOB_LIMITS.postingMax]) {
      expect(postingStatus(count, true)).toEqual({
        text: line(count, copy.postingRange),
        invalid: false,
        live: "",
      });
    }
  });

  it("marks a posting over the maximum invalid", () => {
    const count = JOB_LIMITS.postingMax + 1;
    expect(postingStatus(count, false)).toEqual({
      text: line(count, copy.errors.postingLong),
      invalid: true,
      live: copy.errors.postingLong,
    });
  });
});
