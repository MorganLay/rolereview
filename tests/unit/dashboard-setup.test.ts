import { describe, expect, it } from "vitest";

import { stepTarget } from "@/features/dashboard/components/getting-started";
import type { ContinueWork } from "@/features/dashboard/priorities";

function work(partial: Pick<ContinueWork, "kind" | "href">): ContinueWork {
  return {
    id: "work",
    jobId: "job",
    company: "Lakeshore Civic",
    title: "Product Designer",
    updatedAt: new Date("2026-11-09T12:00:00.000Z"),
    jobStatus: "SAVED",
    ...partial,
  };
}

describe("stepTarget", () => {
  it("sends the library and a job with no resume to the standing pages", () => {
    expect(stepTarget("library", null)).toBe("/library");
    expect(stepTarget("job", null)).toBe("new-job");
    expect(stepTarget("tailor", null)).toBe("/jobs");
    expect(stepTarget("export", work({ kind: "open", href: "/jobs/job" }))).toBe("/jobs");
  });

  it("follows the saved job when that job is the step", () => {
    expect(stepTarget("tailor", work({ kind: "tailor", href: "/jobs/job?tab=documents" }))).toBe(
      "/jobs/job?tab=documents",
    );
    expect(stepTarget("tailor", work({ kind: "tailoring", href: "/jobs/job?tab=documents" }))).toBe(
      "/jobs/job?tab=documents",
    );
    expect(stepTarget("export", work({ kind: "review", href: "/jobs/job/resumes/resume" }))).toBe(
      "/jobs/job/resumes/resume",
    );
    expect(stepTarget("export", work({ kind: "preview", href: "/jobs/job/resumes/resume" }))).toBe(
      "/jobs/job/resumes/resume",
    );
  });
});
