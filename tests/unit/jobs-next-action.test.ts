import { describe, expect, it } from "vitest";

import {
  newestReadyResume,
  nextAction,
  nextActionLabel,
  readyVersionCount,
  type NextActionInput,
} from "@/features/jobs/next-action";
import type { JobStatusValue } from "@/features/jobs/schemas";

const JOB = "job/1 2";
const RESUME = "resume 1";

function input(partial: Partial<NextActionInput> & Pick<NextActionInput, "status">): NextActionInput {
  return {
    jobId: JOB,
    analysisReady: true,
    latestReadyResume: null,
    hasOffer: false,
    ...partial,
  };
}

describe("nextAction", () => {
  it("shows the button for every state in the table", () => {
    expect(nextAction(input({ status: "SAVED" }))).toEqual({
      kind: "tailor",
      href: "/jobs/job%2F1%202?tab=documents",
    });
    expect(nextActionLabel("tailor")).toBe("Tailor resume");

    expect(
      nextAction(input({ status: "SAVED", latestReadyResume: { id: RESUME, exported: false } })),
    ).toEqual({
      kind: "review",
      href: "/jobs/job%2F1%202/resumes/resume%201",
    });
    expect(nextActionLabel("review")).toBe("Review resume");

    expect(
      nextAction(input({ status: "SAVED", latestReadyResume: { id: RESUME, exported: true } })),
    ).toEqual({
      kind: "preview",
      href: "/jobs/job%2F1%202/resumes/resume%201",
    });
    expect(nextActionLabel("preview")).toBe("Preview & export");

    expect(nextAction(input({ status: "APPLIED" }))).toEqual({
      kind: "followUp",
      href: "/jobs/job%2F1%202?tab=timeline",
    });
    expect(nextActionLabel("followUp")).toBe("Log follow-up / update status");

    expect(nextAction(input({ status: "INTERVIEWING" }))).toEqual({
      kind: "interview",
      href: "/jobs/job%2F1%202?tab=interviews",
    });
    expect(nextActionLabel("interview")).toBe("Prepare for next interview");

    expect(nextAction(input({ status: "OFFER", hasOffer: false }))).toEqual({
      kind: "decision",
      href: "/jobs/job%2F1%202?tab=offer",
    });
    expect(nextActionLabel("decision")).toBe("Review decision date");
  });

  it("lets the pipeline status win over the resume", () => {
    const drafted = { id: RESUME, exported: false };
    const cases: { status: JobStatusValue; kind: string | null }[] = [
      { status: "APPLIED", kind: "followUp" },
      { status: "SCREENING", kind: "followUp" },
      { status: "INTERVIEWING", kind: "interview" },
      { status: "OFFER", kind: "decision" },
    ];
    for (const item of cases) {
      expect(
        nextAction(input({ status: item.status, latestReadyResume: drafted }))?.kind,
      ).toBe(item.kind);
    }
  });

  it("hides the action when Saved cannot be tailored, or the job is closed", () => {
    expect(
      nextAction(
        input({
          status: "SAVED",
          analysisReady: false,
          latestReadyResume: { id: RESUME, exported: true },
        }),
      ),
    ).toBeNull();
    expect(nextAction(input({ status: "SAVED", latestReadyResume: { id: "", exported: false } }))?.kind).toBe(
      "tailor",
    );
    expect(nextAction(input({ status: "ACCEPTED", hasOffer: false }))).toBeNull();
    expect(nextAction(input({ status: "ACCEPTED", hasOffer: true }))?.kind).toBe("decision");
    for (const status of ["REJECTED", "WITHDRAWN", "NO_RESPONSE"] as const) {
      expect(nextAction(input({ status, hasOffer: true, latestReadyResume: { id: RESUME, exported: true } }))).toBeNull();
    }
  });
});

describe("newestReadyResume", () => {
  it("keeps the highest version, and the lower id on a tie", () => {
    expect(newestReadyResume([])).toBeNull();
    expect(
      newestReadyResume([
        { id: "", version: 9, exported: true },
        { id: "b", version: 1, exported: true },
        { id: "a", version: 2, exported: false },
      ]),
    ).toEqual({ id: "a", exported: false });
    expect(
      newestReadyResume([
        { id: "b", version: 3, exported: true },
        { id: "a", version: 3, exported: false },
      ]),
    ).toEqual({ id: "a", exported: false });
  });
});

describe("readyVersionCount", () => {
  it("counts ready resumes and letters only", () => {
    expect(readyVersionCount([], [])).toBe(0);
    expect(
      readyVersionCount(
        [{ status: "READY" }, { status: "PENDING" }, { status: "FAILED" }, { status: "" }],
        [{ status: "READY" }, { status: "ready" }],
      ),
    ).toBe(2);
  });
});
