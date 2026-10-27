import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  onboardingComplete,
  onboardingSteps,
  pipelineCounts,
  recentJobs,
  thisWeek,
  weekBounds,
  type WeekJob,
} from "@/features/dashboard/metrics";

const ZONE = "America/Toronto";

/** Thursday 22 Oct 2026, 11:00 EDT. */
const NOW = new Date("2026-10-22T15:00:00.000Z");

function weekJob(partial: Partial<WeekJob>): WeekJob {
  return {
    archived: false,
    appliedAt: null,
    firstResponseAt: null,
    submittedResumeId: null,
    ...partial,
  };
}

describe("weekBounds", () => {
  it("starts Monday and ends the next Monday in the user's timezone", () => {
    const { start, end } = weekBounds(NOW, ZONE);
    expect(start.toISOString()).toBe("2026-10-19T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-26T04:00:00.000Z");
  });

  it("keeps Sunday evening in the week that is about to end", () => {
    const sundayNight = new Date("2026-10-26T03:30:00.000Z");
    const { start, end } = weekBounds(sundayNight, ZONE);
    expect(start.toISOString()).toBe("2026-10-19T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-26T04:00:00.000Z");
    expect(sundayNight.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(sundayNight.getTime()).toBeLessThan(end.getTime());
  });

  it("starts a new week at Monday 00:00 local", () => {
    const monday = new Date("2026-10-26T04:30:00.000Z");
    const { start, end } = weekBounds(monday, ZONE);
    expect(start.toISOString()).toBe("2026-10-26T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("still brackets now across the autumn clock change", () => {
    const now = new Date("2026-11-01T17:00:00.000Z");
    const { start, end } = weekBounds(now, ZONE);
    expect(start.getTime()).toBeLessThan(now.getTime());
    expect(now.getTime()).toBeLessThan(end.getTime());
    expect(end.getTime() - start.getTime()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  });

  it("uses UTC when the zone is not a real IANA name", () => {
    const { start, end } = weekBounds(NOW, "Not/AZone");
    expect(start.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("pipelineCounts", () => {
  it("adds the closed statuses together and skips archived jobs", () => {
    expect(
      pipelineCounts([
        { status: "SAVED", archived: false },
        { status: "APPLIED", archived: false },
        { status: "APPLIED", archived: true },
        { status: "SCREENING", archived: false },
        { status: "INTERVIEWING", archived: false },
        { status: "OFFER", archived: false },
        { status: "ACCEPTED", archived: false },
        { status: "REJECTED", archived: false },
        { status: "WITHDRAWN", archived: false },
        { status: "NO_RESPONSE", archived: true },
      ]),
    ).toEqual({
      SAVED: 1,
      APPLIED: 1,
      SCREENING: 1,
      INTERVIEWING: 1,
      OFFER: 1,
      CLOSED: 3,
    });
  });
});

describe("thisWeek", () => {
  const inWeek = new Date("2026-10-20T16:00:00.000Z");
  const lastWeek = new Date("2026-10-18T16:00:00.000Z");
  const nextWeek = new Date("2026-10-26T04:00:00.000Z");

  it("counts applications, tailored share, and responses inside the week", () => {
    const jobs = [
      weekJob({ appliedAt: inWeek, submittedResumeId: "resume" }),
      weekJob({ appliedAt: inWeek }),
      weekJob({ appliedAt: inWeek, submittedResumeId: "other" }),
      weekJob({ appliedAt: lastWeek, firstResponseAt: inWeek }),
      weekJob({ firstResponseAt: nextWeek }),
      weekJob({ appliedAt: inWeek, archived: true, submittedResumeId: "hidden" }),
    ];
    expect(thisWeek(jobs, NOW, ZONE)).toEqual({
      applications: 3,
      tailoredPercent: 67,
      responses: 1,
    });
  });

  it("leaves the tailored share empty when nothing was sent", () => {
    expect(thisWeek([], NOW, ZONE)).toEqual({
      applications: 0,
      tailoredPercent: null,
      responses: 0,
    });
    expect(thisWeek([weekJob({ appliedAt: inWeek })], NOW, ZONE).tailoredPercent).toBe(0);
  });

  it("puts a Sunday-evening application in the week that contains that evening", () => {
    const sundayNight = new Date("2026-10-26T03:30:00.000Z");
    const sent = new Date("2026-10-26T03:00:00.000Z");
    expect(thisWeek([weekJob({ appliedAt: sent })], sundayNight, ZONE).applications).toBe(1);
    const monday = new Date("2026-10-26T04:30:00.000Z");
    expect(thisWeek([weekJob({ appliedAt: sent })], monday, ZONE).applications).toBe(0);
  });
});

describe("recentJobs", () => {
  it("keeps five, newest first, and breaks a tie with id", () => {
    const same = new Date("2026-10-22T12:00:00.000Z");
    const picked = recentJobs(
      [
        { id: "b", updatedAt: same, archived: false },
        { id: "a", updatedAt: same, archived: false },
        { id: "old", updatedAt: new Date("2026-01-01T00:00:00.000Z"), archived: false },
        { id: "hidden", updatedAt: new Date("2026-12-01T00:00:00.000Z"), archived: true },
        { id: "c", updatedAt: new Date("2026-10-21T00:00:00.000Z"), archived: false },
        { id: "d", updatedAt: new Date("2026-10-20T00:00:00.000Z"), archived: false },
        { id: "e", updatedAt: new Date("2026-10-19T00:00:00.000Z"), archived: false },
      ],
      5,
    );
    expect(picked.map((job) => job.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("onboardingSteps", () => {
  it("needs one entry, one job, one ready resume, and one export", () => {
    const steps = onboardingSteps({
      entries: 0,
      jobs: 0,
      readyResumes: 0,
      exportedResumes: 0,
    });
    expect(steps.map((step) => step.done)).toEqual([false, false, false, false]);
    expect(onboardingComplete(steps)).toBe(false);

    const ready = onboardingSteps({
      entries: 1,
      jobs: 2,
      readyResumes: 1,
      exportedResumes: 1,
    });
    expect(onboardingComplete(ready)).toBe(true);
    expect(onboardingComplete([])).toBe(false);
  });
});

describe("addCalendarDays", () => {
  it("crosses a month and leaves a bad string alone", () => {
    expect(addCalendarDays("2026-10-22", -31)).toBe("2026-09-21");
    expect(addCalendarDays("2026-10-22", 3)).toBe("2026-10-25");
    expect(addCalendarDays("nope", 1)).toBe("nope");
  });
});
