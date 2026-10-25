import { describe, expect, it } from "vitest";

import {
  BREAKDOWN_MIN_APPLICATIONS,
  insightsMetrics,
  insightsRangeStart,
  parseInsightsRange,
  RESPONSE_WINDOW_MS,
  SOURCE_NONE,
  toInsightsJob,
  type InsightsJob,
} from "@/features/insights/metrics";
import type { JobSourceValue, JobStatusValue } from "@/features/jobs/schemas";

const ZONE = "America/Toronto";

/** Thursday 22 Oct 2026, 11:00 EDT. */
const NOW = new Date("2026-10-22T15:00:00.000Z");

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number, extraMs = 0): Date {
  return new Date(NOW.getTime() - days * DAY - extraMs);
}

function job(partial: Partial<InsightsJob> = {}): InsightsJob {
  return {
    status: "APPLIED",
    source: null,
    appliedAt: daysAgo(30),
    createdAt: daysAgo(40),
    firstResponseAt: null,
    submittedResumeId: null,
    matchScore: null,
    interviewCount: 0,
    offerEvent: false,
    ...partial,
  };
}

function after(appliedAt: Date, days: number): Date {
  return new Date(appliedAt.getTime() + days * DAY);
}

describe("insights range", () => {
  it("starts 30 and 90 calendar days back at Toronto midnight", () => {
    expect(insightsRangeStart("30d", NOW, ZONE)?.toISOString()).toBe("2026-09-23T04:00:00.000Z");
    expect(insightsRangeStart("90d", NOW, ZONE)?.toISOString()).toBe("2026-07-25T04:00:00.000Z");
    expect(insightsRangeStart("all", NOW, ZONE)).toBeNull();
  });

  it("keeps a job on the first local midnight and drops the millisecond before it", () => {
    const start = insightsRangeStart("30d", NOW, ZONE)!;
    const metrics = insightsMetrics(
      [
        job({ appliedAt: start }),
        job({ appliedAt: new Date(start.getTime() - 1) }),
        job({ appliedAt: new Date(NOW.getTime() + 1) }),
      ],
      { range: "30d", now: NOW, timeZone: ZONE },
    );
    expect(metrics.applied).toBe(1);
  });
});

describe("seed-like hunt", () => {
  const recent = daysAgo(2);
  const stale = daysAgo(31);
  const screeningAt = daysAgo(20);
  const interviewingAt = daysAgo(40);
  const offerAt = daysAgo(45);
  const acceptedAt = daysAgo(60);
  const rejectedAt = daysAgo(25);

  const hunt: InsightsJob[] = [
    job({ status: "SAVED", source: "COMPANY_SITE", appliedAt: null }),
    job({ status: "APPLIED", source: "JOB_BANK", appliedAt: stale }),
    job({
      status: "APPLIED",
      source: "LINKEDIN",
      appliedAt: recent,
      submittedResumeId: "resume-recent",
      matchScore: 82,
    }),
    job({
      status: "SCREENING",
      source: "INDEED",
      appliedAt: screeningAt,
      firstResponseAt: after(screeningAt, 6),
      interviewCount: 1,
    }),
    job({
      status: "INTERVIEWING",
      source: "REFERRAL",
      appliedAt: interviewingAt,
      firstResponseAt: after(interviewingAt, 11),
      interviewCount: 2,
      matchScore: 74,
    }),
    job({
      status: "OFFER",
      source: "RECRUITER",
      appliedAt: offerAt,
      firstResponseAt: after(offerAt, 8),
      offerEvent: true,
    }),
    job({
      status: "ACCEPTED",
      source: "COMPANY_SITE",
      appliedAt: acceptedAt,
      firstResponseAt: after(acceptedAt, 20),
    }),
    job({
      status: "REJECTED",
      source: "OTHER",
      appliedAt: rejectedAt,
      firstResponseAt: after(rejectedAt, 4),
    }),
  ];

  it("counts the seven applications and shows only the not-tailored group", () => {
    const metrics = insightsMetrics(hunt, { range: "all", now: NOW, timeZone: ZONE });

    expect(metrics.applied).toBe(7);
    expect(metrics.funnel.map((stage) => [stage.key, stage.count])).toEqual([
      ["SAVED", 8],
      ["APPLIED", 7],
      ["RESPONDED", 5],
      ["INTERVIEWED", 4],
      ["OFFER", 2],
    ]);
    expect(metrics.responded).toBe(5);
    expect(metrics.response).toEqual({ count: 5, of: 6, rate: 5 / 6 });
    expect(metrics.interview).toEqual({ count: 4, of: 7, rate: 4 / 7 });
    expect(metrics.offer).toEqual({ count: 2, of: 7, rate: 2 / 7 });
    expect(metrics.medianDaysToResponse).toBe(8);
    expect(metrics.bySource).toEqual([]);
    expect(metrics.byMatchBand).toEqual([]);
    expect(metrics.tailored).toEqual([
      {
        key: "NOT_TAILORED",
        applications: 6,
        response: { count: 5, of: 6, rate: 5 / 6 },
        interview: { count: 4, of: 6, rate: 4 / 6 },
        offer: { count: 2, of: 6, rate: 2 / 6 },
        medianDaysToResponse: 8,
      },
    ]);
  });

  it("limits 30 days to the recent, screening, and rejected applications", () => {
    const metrics = insightsMetrics(hunt, { range: "30d", now: NOW, timeZone: ZONE });

    expect(metrics.applied).toBe(3);
    expect(metrics.funnel.map((stage) => [stage.key, stage.count, stage.fromPrevious])).toEqual([
      ["SAVED", 3, null],
      ["APPLIED", 3, 1],
      ["RESPONDED", 2, 2 / 3],
      ["INTERVIEWED", 1, 1 / 2],
      ["OFFER", 0, 0],
    ]);
    expect(metrics.responded).toBe(2);
    expect(metrics.response).toEqual({ count: 2, of: 2, rate: 1 });
    expect(metrics.interview).toEqual({ count: 1, of: 3, rate: 1 / 3 });
    expect(metrics.offer).toEqual({ count: 0, of: 3, rate: 0 });
    expect(metrics.medianDaysToResponse).toBe(5);
  });

  it("keeps the 60-day application in 90 days and drops one from 100 days ago", () => {
    const older = [...hunt, job({ appliedAt: daysAgo(100) })];
    expect(insightsMetrics(older, { range: "90d", now: NOW, timeZone: ZONE }).applied).toBe(7);
    expect(insightsMetrics(hunt, { range: "90d", now: NOW, timeZone: ZONE }).applied).toBe(7);
    expect(insightsMetrics(older, { range: "all", now: NOW, timeZone: ZONE }).applied).toBe(8);
  });
});

describe("response window and offer evidence", () => {
  it("includes a job applied exactly 7 days ago and leaves out one millisecond newer", () => {
    const exact = new Date(NOW.getTime() - RESPONSE_WINDOW_MS);
    const newer = new Date(exact.getTime() + 1);
    const quiet = daysAgo(8);
    const metrics = insightsMetrics(
      [
        job({ appliedAt: exact, firstResponseAt: after(exact, 1) }),
        job({ appliedAt: newer, firstResponseAt: after(newer, 3) }),
        job({ appliedAt: quiet }),
      ],
      { range: "all", now: NOW, timeZone: ZONE },
    );

    expect(metrics.applied).toBe(3);
    expect(metrics.responded).toBe(2);
    expect(metrics.response).toEqual({ count: 1, of: 2, rate: 1 / 2 });
    expect(metrics.medianDaysToResponse).toBe(2);
  });

  it("counts Offer or Accepted from the status or from an event", () => {
    const metrics = insightsMetrics(
      [
        job({ status: "REJECTED", offerEvent: true }),
        job({ status: "SCREENING" }),
        job({ status: "OFFER" }),
        job({ status: "ACCEPTED" }),
        job({ status: "APPLIED" }),
      ],
      { range: "all", now: NOW, timeZone: ZONE },
    );

    expect(metrics.offer).toEqual({ count: 3, of: 5, rate: 3 / 5 });
    expect(metrics.interview).toEqual({ count: 3, of: 5, rate: 3 / 5 });
    expect(metrics.responded).toBe(3);
  });

  it("counts two interviews on one job as one interviewed application", () => {
    const metrics = insightsMetrics(
      [job({ interviewCount: 2 }), job({ interviewCount: 0 })],
      { range: "all", now: NOW, timeZone: ZONE },
    );
    expect(metrics.interview).toEqual({ count: 1, of: 2, rate: 1 / 2 });
  });
});

describe("empty and median", () => {
  it("returns empty rates when nobody has applied", () => {
    const metrics = insightsMetrics(
      [job({ status: "SAVED", appliedAt: null })],
      { range: "30d", now: NOW, timeZone: ZONE },
    );

    expect(metrics.applied).toBe(0);
    expect(metrics.response).toEqual({ count: 0, of: 0, rate: null });
    expect(metrics.interview.rate).toBeNull();
    expect(metrics.offer.rate).toBeNull();
    expect(metrics.medianDaysToResponse).toBeNull();
    expect(metrics.weeks).toEqual([]);
  });

  it("averages the two middle durations when the count is even", () => {
    const first = daysAgo(20);
    const second = daysAgo(18);
    const third = daysAgo(16);
    const fourth = daysAgo(14);
    const metrics = insightsMetrics(
      [
        job({ appliedAt: first, firstResponseAt: after(first, 1) }),
        job({ appliedAt: second, firstResponseAt: after(second, 4) }),
        job({ appliedAt: third, firstResponseAt: after(third, 10) }),
        job({ appliedAt: fourth, firstResponseAt: after(fourth, 12) }),
      ],
      { range: "all", now: NOW, timeZone: ZONE },
    );
    expect(metrics.medianDaysToResponse).toBe(7);
  });
});

describe("breakdowns", () => {
  it(`hides a source under ${BREAKDOWN_MIN_APPLICATIONS} and labels a source of 7`, () => {
    const linkedin = Array.from({ length: 7 }, (_, index) =>
      job({
        source: "LINKEDIN",
        appliedAt: daysAgo(30),
        firstResponseAt: index < 3 ? after(daysAgo(30), 4) : null,
      }),
    );
    const indeed = Array.from({ length: 4 }, () => job({ source: "INDEED" }));
    const metrics = insightsMetrics([...linkedin, ...indeed], {
      range: "all",
      now: NOW,
      timeZone: ZONE,
    });

    expect(metrics.bySource.map((group) => group.key)).toEqual(["LINKEDIN"]);
    expect(metrics.bySource[0]).toMatchObject({
      applications: 7,
      response: { count: 3, of: 7, rate: 3 / 7 },
    });
  });

  it("drops recent applications from a group's response rate", () => {
    const jobs = [
      ...Array.from({ length: 4 }, () =>
        job({
          source: "REFERRAL",
          appliedAt: daysAgo(1),
          firstResponseAt: daysAgo(0),
        }),
      ),
      job({ source: "REFERRAL", appliedAt: daysAgo(30) }),
    ];
    const metrics = insightsMetrics(jobs, { range: "all", now: NOW, timeZone: ZONE });
    expect(metrics.bySource[0]).toMatchObject({
      key: "REFERRAL",
      applications: 5,
      response: { count: 0, of: 1, rate: 0 },
    });
  });

  it("bands 49, 50, 74, and 75, and skips a submitted resume with no score", () => {
    const band = (score: number, count: number) =>
      Array.from({ length: count }, () =>
        job({ submittedResumeId: "resume", matchScore: score, source: "OTHER" }),
      );
    const metrics = insightsMetrics(
      [
        ...band(49, 5),
        ...band(50, 5),
        ...band(74, 5),
        ...band(75, 4),
        ...Array.from({ length: 5 }, () =>
          job({ submittedResumeId: "resume", matchScore: null, source: "OTHER" }),
        ),
      ],
      { range: "all", now: NOW, timeZone: ZONE },
    );

    expect(metrics.byMatchBand.map((group) => [group.key, group.applications])).toEqual([
      ["UNDER_50", 5],
      ["FROM_50_TO_74", 10],
    ]);
    expect(metrics.tailored.map((group) => [group.key, group.applications])).toEqual([
      ["TAILORED", 24],
    ]);
  });

  it("keeps a missing source as its own group once it reaches 5", () => {
    const metrics = insightsMetrics(
      Array.from({ length: 5 }, () => job({ source: null })),
      { range: "all", now: NOW, timeZone: ZONE },
    );
    expect(metrics.bySource.map((group) => group.key)).toEqual([SOURCE_NONE]);
    expect(metrics.tailored.map((group) => group.key)).toEqual(["NOT_TAILORED"]);
  });
});

describe("weekly applications", () => {
  it("splits Sunday night from Monday morning and fills the empty weeks", () => {
    const metrics = insightsMetrics(
      [
        job({ appliedAt: new Date("2026-10-19T03:59:00.000Z") }),
        job({
          appliedAt: new Date("2026-10-19T04:00:00.000Z"),
          submittedResumeId: "resume",
        }),
      ],
      { range: "30d", now: NOW, timeZone: ZONE },
    );

    expect(metrics.weeks.map((week) => week.weekStart)).toEqual([
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
    ]);
    expect(metrics.weeks[3]).toEqual({ weekStart: "2026-10-12", tailored: 0, notTailored: 1 });
    expect(metrics.weeks[4]).toEqual({ weekStart: "2026-10-19", tailored: 1, notTailored: 0 });
  });
});

describe("funnel window", () => {
  it("counts a saved job by createdAt and an offer with no interview as every earlier stage", () => {
    const metrics = insightsMetrics(
      [
        job({ status: "SAVED", appliedAt: null, createdAt: daysAgo(2) }),
        job({ status: "SAVED", appliedAt: null, createdAt: daysAgo(40) }),
        job({
          createdAt: daysAgo(100),
          appliedAt: daysAgo(3),
          status: "OFFER",
          interviewCount: 0,
          firstResponseAt: null,
        }),
      ],
      { range: "30d", now: NOW, timeZone: ZONE },
    );

    expect(metrics.applied).toBe(1);
    expect(metrics.responded).toBe(1);
    expect(metrics.interview).toEqual({ count: 1, of: 1, rate: 1 });
    expect(metrics.response).toEqual({ count: 0, of: 0, rate: null });
    expect(metrics.funnel.map((stage) => [stage.key, stage.count])).toEqual([
      ["SAVED", 2],
      ["APPLIED", 1],
      ["RESPONDED", 1],
      ["INTERVIEWED", 1],
      ["OFFER", 1],
    ]);
    expect(metrics.funnel[3]?.fromPrevious).toBe(1);
    expect(metrics.funnel[4]?.fromPrevious).toBe(1);
  });

  it("leaves the next share empty when the previous stage is zero", () => {
    const metrics = insightsMetrics([], { range: "all", now: NOW, timeZone: ZONE });
    expect(metrics.funnel.map((stage) => stage.fromPrevious)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("drops a job applied outside the window even when it was saved inside", () => {
    const metrics = insightsMetrics(
      [job({ createdAt: daysAgo(1), appliedAt: daysAgo(100) })],
      { range: "30d", now: NOW, timeZone: ZONE },
    );
    expect(metrics.funnel.every((stage) => stage.count === 0)).toBe(true);
  });
});

describe("range query", () => {
  it("keeps 30 days, 90 days, and all, and treats anything else as 30 days", () => {
    expect(parseInsightsRange(undefined)).toBe("30d");
    expect(parseInsightsRange("90d")).toBe("90d");
    expect(parseInsightsRange(["all"])).toBe("all");
    expect(parseInsightsRange("week")).toBe("30d");
    expect(parseInsightsRange(["30d", "all"])).toBe("30d");
  });
});

describe("toInsightsJob", () => {
  it("drops an unknown status and an unknown source", () => {
    expect(
      toInsightsJob({
        status: "HOLD",
        source: "LINKEDIN",
        appliedAt: NOW,
        createdAt: NOW,
        firstResponseAt: null,
        submittedResumeId: null,
        matchScore: null,
        interviewCount: 0,
        offerEvent: false,
      }),
    ).toBeNull();

    const mapped = toInsightsJob({
      status: "APPLIED" satisfies JobStatusValue,
      source: "BOARD",
      appliedAt: null,
      createdAt: NOW,
      firstResponseAt: null,
      submittedResumeId: null,
      matchScore: 10,
      interviewCount: 1,
      offerEvent: true,
    });
    expect(mapped?.source).toBeNull();
    expect(mapped?.offerEvent).toBe(true);
  });

  it("keeps a known source", () => {
    const source: JobSourceValue = "GC_JOBS";
    expect(
      toInsightsJob({
        status: "SAVED",
        source,
        appliedAt: null,
        createdAt: NOW,
        firstResponseAt: null,
        submittedResumeId: null,
        matchScore: null,
        interviewCount: 0,
        offerEvent: false,
      })?.source,
    ).toBe(source);
  });
});
