import { describe, expect, it } from "vitest";

import {
  continueWorking,
  dashboardActions,
  dashboardSummary,
  isSpecificJobHref,
  recentActivity,
  type HomeJob,
  type HomeReminder,
} from "@/features/dashboard/priorities";
import { nextAction } from "@/features/jobs/next-action";

const ZONE = "America/Toronto";

/** Thursday 22 Oct 2026, 11:00 EDT. */
const NOW = new Date("2026-10-22T15:00:00.000Z");
const SAME = new Date("2026-10-22T00:00:00.000Z");

function reminder(partial: Partial<HomeReminder> & Pick<HomeReminder, "id" | "kind">): HomeReminder {
  return {
    title: partial.kind,
    dueAt: NOW,
    open: true,
    ...partial,
  };
}

function homeJob(partial: Partial<HomeJob> & Pick<HomeJob, "id">): HomeJob {
  return {
    company: "Acme",
    title: "Designer",
    status: "SAVED",
    archived: false,
    appliedAt: null,
    firstResponseAt: null,
    submittedResumeId: null,
    analysisReady: true,
    hasOffer: false,
    deadline: null,
    respondBy: null,
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    reminders: [],
    interviews: [],
    resumes: [],
    ...partial,
  };
}

function keys(jobs: HomeJob[], now = NOW): string[] {
  return dashboardActions(jobs, now, ZONE).map((item) => `${item.kind}:${item.id}`);
}

describe("dashboardActions order", () => {
  it("puts an overdue date before an upcoming one, and a sooner date before a later one", () => {
    const jobs = [
      homeJob({
        id: "later",
        deadline: "2026-10-25",
        reminders: [reminder({ id: "d", kind: "DEADLINE", dueAt: NOW })],
      }),
      homeJob({
        id: "soon",
        status: "INTERVIEWING",
        interviews: [
          {
            id: "i",
            round: 1,
            kind: "HIRING_MANAGER",
            scheduledAt: new Date(NOW.getTime() + 60 * 60 * 1000),
          },
        ],
      }),
      homeJob({
        id: "overdue",
        status: "APPLIED",
        reminders: [
          reminder({
            id: "f",
            kind: "FOLLOW_UP",
            dueAt: new Date("2026-10-21T16:00:00.000Z"),
          }),
        ],
      }),
    ];
    expect(keys(jobs)).toEqual([
      "followUp:followUp:f",
      "interview:interview:i",
      "deadline:deadline:d",
    ]);
  });

  it("breaks a tied instant by deadline, offer, interview, follow-up, then document", () => {
    const jobs = [
      homeJob({
        id: "doc",
        status: "INTERVIEWING",
        resumes: [
          {
            id: "r",
            version: 1,
            exported: false,
            submitted: false,
            updatedAt: NOW,
          },
        ],
      }),
      homeJob({
        id: "plain",
        status: "SCREENING",
      }),
      homeJob({
        id: "tied",
        status: "OFFER",
        hasOffer: true,
        deadline: "2026-10-22",
        respondBy: "2026-10-22",
        reminders: [
          reminder({ id: "b", kind: "DEADLINE", dueAt: SAME }),
          reminder({ id: "a", kind: "DEADLINE", dueAt: SAME }),
          reminder({ id: "fu", kind: "FOLLOW_UP", dueAt: SAME }),
        ],
        interviews: [
          { id: "iv", round: 2, kind: "PANEL", scheduledAt: SAME },
        ],
      }),
    ];
    expect(keys(jobs, SAME)).toEqual([
      "deadline:deadline:a",
      "deadline:deadline:b",
      "offer:offer:tied",
      "interview:interview:iv",
      "followUp:followUp:fu",
      "followUp:followUpNext:plain",
      "document:document:doc:r",
    ]);
    const actions = dashboardActions(jobs, SAME, ZONE);
    expect(actions.filter((item) => item.sortAt === null).map((item) => item.kind)).toEqual([
      "followUp",
      "document",
    ]);
    expect(actions.every((item) => item.sortAt === null || item.sortAt === SAME.getTime() || item.kind === "document" || item.kind === "followUp")).toBe(true);
  });

  it("keeps undated document work after a follow-up that is weeks away", () => {
    const actions = dashboardActions(
      [
        homeJob({
          id: "saved",
          resumes: [
            {
              id: "resume",
              version: 1,
              exported: false,
              submitted: false,
              updatedAt: NOW,
            },
          ],
        }),
        homeJob({
          id: "applied",
          status: "APPLIED",
          reminders: [
            reminder({
              id: "later",
              kind: "FOLLOW_UP",
              dueAt: new Date("2026-11-21T16:00:00.000Z"),
            }),
          ],
        }),
      ],
      NOW,
      ZONE,
    );
    expect(actions.map((item) => item.kind)).toEqual(["followUp", "document"]);
    expect(actions[1]?.sortAt).toBeNull();
  });
});

describe("dashboardActions links", () => {
  it("uses the job next step for a deadline, and a resume for unfinished documents", () => {
    const saved = homeJob({
      id: "job/1 2",
      deadline: "2026-10-25",
      reminders: [reminder({ id: "d", kind: "DEADLINE" })],
    });
    const drafted = homeJob({
      id: "job/1 2",
      status: "SAVED",
      resumes: [
        { id: "resume 1", version: 2, exported: false, submitted: false, updatedAt: NOW },
        { id: "older", version: 1, exported: false, submitted: false, updatedAt: NOW },
      ],
    });
    const interviewing = homeJob({
      id: "live",
      status: "INTERVIEWING",
      resumes: [
        { id: "draft", version: 1, exported: false, submitted: false, updatedAt: NOW },
      ],
    });
    const unread = homeJob({
      id: "unread",
      analysisReady: false,
      deadline: "2026-10-22",
      reminders: [reminder({ id: "d2", kind: "DEADLINE" })],
    });

    const savedAction = dashboardActions([saved], NOW, ZONE)[0];
    expect(savedAction?.href).toBe(
      nextAction({
        jobId: saved.id,
        status: "SAVED",
        analysisReady: true,
        latestReadyResume: null,
        hasOffer: false,
      })?.href,
    );
    expect(savedAction?.href).toBe("/jobs/job%2F1%202?tab=documents");

    const document = dashboardActions([drafted], NOW, ZONE).find((item) => item.kind === "document");
    expect(document?.href).toBe("/jobs/job%2F1%202/resumes/resume%201");
    expect(document?.reason).toEqual({ type: "document", exported: false });

    const live = dashboardActions([interviewing], NOW, ZONE)[0];
    expect(live?.href).toBe("/jobs/live/resumes/draft");
    expect(live?.href).not.toContain("?tab=");

    expect(dashboardActions([unread], NOW, ZONE)[0]?.href).toBe("/jobs/unread?tab=reminders");
  });

  it("opens interviews, offers, and follow-ups on their own tabs", () => {
    const actions = dashboardActions(
      [
        homeJob({
          id: "offer",
          status: "OFFER",
          hasOffer: true,
          respondBy: "2026-10-24",
          reminders: [reminder({ id: "or", kind: "OFFER_RESPONSE", dueAt: new Date("2026-10-21T16:00:00.000Z") })],
        }),
        homeJob({
          id: "talk",
          status: "INTERVIEWING",
          interviews: [
            {
              id: "soon",
              round: 1,
              kind: "PHONE_SCREEN",
              scheduledAt: new Date(NOW.getTime() + 30 * 60 * 60 * 1000),
            },
            {
              id: "past",
              round: 2,
              kind: "PANEL",
              scheduledAt: new Date(NOW.getTime() - 60 * 60 * 1000),
            },
            {
              id: "later",
              round: 3,
              kind: "FINAL",
              scheduledAt: new Date(NOW.getTime() + 49 * 60 * 60 * 1000),
            },
          ],
          reminders: [reminder({ id: "ir", kind: "INTERVIEW", dueAt: NOW })],
        }),
        homeJob({
          id: "screen",
          status: "SCREENING",
          reminders: [reminder({ id: "c", kind: "CUSTOM", title: "Send the portfolio", dueAt: new Date("2026-10-27T16:00:00.000Z") })],
        }),
      ],
      NOW,
      ZONE,
    );

    expect(actions.filter((item) => item.kind === "offer")).toHaveLength(1);
    expect(actions.find((item) => item.kind === "offer")?.href).toBe("/jobs/offer?tab=offer");
    expect(actions.find((item) => item.id === "interview:soon")?.href).toBe("/jobs/talk?tab=interviews");
    expect(actions.find((item) => item.id === "interview:past")).toBeUndefined();
    expect(actions.find((item) => item.id === "interview:later")?.reason).toMatchObject({ soon: false });
    expect(actions.find((item) => item.id === "interview:soon")?.reason).toMatchObject({ soon: true });
    expect(actions.find((item) => item.id === "followUp:ir")?.href).toBe("/jobs/talk?tab=interviews");
    expect(actions.find((item) => item.id === "followUp:c")?.href).toBe("/jobs/screen?tab=timeline");
    expect(actions.find((item) => item.id === "followUpNext:screen")).toBeUndefined();
    expect(actions.every((item) => isSpecificJobHref(item.href))).toBe(true);
    for (const href of actions.map((item) => item.href)) {
      expect(href).not.toBe("/jobs");
      expect(href).not.toBe("/dashboard");
      expect(href).not.toMatch(/^\/jobs\/[^/?]+$/);
    }
  });

  it("marks 30 days with no response, and leaves day 29 as an ordinary follow-up", () => {
    const actions = dashboardActions(
      [
        homeJob({
          id: "old",
          status: "APPLIED",
          appliedAt: new Date("2026-09-22T16:00:00.000Z"),
        }),
        homeJob({
          id: "young",
          status: "APPLIED",
          appliedAt: new Date("2026-09-23T16:00:00.000Z"),
        }),
        homeJob({
          id: "evening",
          status: "APPLIED",
          appliedAt: new Date("2026-09-23T03:30:00.000Z"),
        }),
      ],
      NOW,
      ZONE,
    );
    expect(actions.find((item) => item.jobId === "old")?.reason).toEqual({
      type: "followUpNext",
      stale: true,
    });
    expect(actions.find((item) => item.jobId === "young")?.reason).toEqual({
      type: "followUpNext",
      stale: false,
    });
    expect(actions.find((item) => item.jobId === "evening")?.reason).toEqual({
      type: "followUpNext",
      stale: true,
    });
    expect(actions.find((item) => item.jobId === "old")?.href).toBe("/jobs/old?tab=timeline");
  });

  it("leaves out archived jobs, closed jobs, and reminders that are not open", () => {
    const actions = dashboardActions(
      [
        homeJob({
          id: "archived",
          archived: true,
          deadline: "2026-10-01",
          reminders: [reminder({ id: "d", kind: "DEADLINE" })],
        }),
        homeJob({
          id: "closed",
          status: "ACCEPTED",
          hasOffer: true,
          respondBy: "2026-10-01",
        }),
        homeJob({
          id: "done",
          deadline: "2026-10-01",
          reminders: [reminder({ id: "d", kind: "DEADLINE", open: false })],
        }),
      ],
      NOW,
      ZONE,
    );
    expect(actions).toEqual([]);
  });
});

describe("dashboardSummary", () => {
  it("counts active, interviewing, and offer jobs, and only urgent dated items", () => {
    const jobs = [
      homeJob({
        id: "saved",
        deadline: "2026-10-22",
        reminders: [reminder({ id: "today", kind: "DEADLINE" })],
      }),
      homeJob({
        id: "later-deadline",
        deadline: "2026-10-25",
        reminders: [reminder({ id: "later", kind: "DEADLINE" })],
      }),
      homeJob({ id: "talk", status: "INTERVIEWING" }),
      homeJob({
        id: "offer",
        status: "OFFER",
        hasOffer: true,
        respondBy: "2026-10-21",
      }),
      homeJob({
        id: "applied",
        status: "APPLIED",
        reminders: [reminder({ id: "due", kind: "FOLLOW_UP", dueAt: new Date("2026-10-22T20:00:00.000Z") })],
      }),
      homeJob({ id: "accepted", status: "ACCEPTED" }),
      homeJob({ id: "hidden", status: "OFFER", archived: true, hasOffer: true }),
      homeJob({
        id: "far",
        status: "INTERVIEWING",
        interviews: [
          {
            id: "far",
            round: 1,
            kind: "PANEL",
            scheduledAt: new Date(NOW.getTime() + 49 * 60 * 60 * 1000),
          },
        ],
      }),
    ];
    const actions = dashboardActions(jobs, NOW, ZONE);
    expect(dashboardSummary(jobs, actions)).toEqual({
      active: 6,
      interviews: 2,
      offers: 1,
      urgent: 3,
    });
    expect(dashboardSummary([], [])).toEqual({
      active: 0,
      interviews: 0,
      offers: 0,
      urgent: 0,
    });
  });
});

describe("continueWorking", () => {
  it("keeps the latest resume or job, and prefers the resume when the time matches", () => {
    const same = new Date("2026-10-22T12:00:00.000Z");
    const picked = continueWorking([
      homeJob({
        id: "older",
        status: "APPLIED",
        updatedAt: new Date("2026-10-20T12:00:00.000Z"),
      }),
      homeJob({
        id: "closed",
        status: "REJECTED",
        updatedAt: new Date("2026-10-22T18:00:00.000Z"),
        resumes: [
          { id: "closed-resume", version: 1, exported: false, submitted: false, updatedAt: NOW },
        ],
      }),
      homeJob({
        id: "live",
        status: "INTERVIEWING",
        updatedAt: same,
        resumes: [
          { id: "sent", version: 1, exported: true, submitted: true, updatedAt: NOW },
          { id: "draft", version: 2, exported: false, submitted: false, updatedAt: same },
        ],
      }),
    ]);
    expect(picked).toMatchObject({
      source: "resume",
      href: "/jobs/live/resumes/draft",
      nextKind: null,
    });

    const jobWins = continueWorking([
      homeJob({
        id: "offer job",
        status: "OFFER",
        hasOffer: true,
        updatedAt: new Date("2026-10-22T18:00:00.000Z"),
        resumes: [
          {
            id: "draft",
            version: 1,
            exported: false,
            submitted: false,
            updatedAt: new Date("2026-10-22T12:00:00.000Z"),
          },
        ],
      }),
    ]);
    expect(jobWins?.href).toBe("/jobs/offer%20job?tab=offer");
    expect(jobWins?.nextKind).toBe("decision");
  });

  it("skips a job that has no specific next step", () => {
    expect(
      continueWorking([
        homeJob({
          id: "unread",
          analysisReady: false,
          updatedAt: NOW,
        }),
      ]),
    ).toBeNull();
  });
});

describe("recentActivity", () => {
  it("keeps five newest events and drops archived jobs", () => {
    const same = new Date("2026-10-22T12:00:00.000Z");
    const items = recentActivity([
      {
        id: "b",
        jobId: "job",
        company: "Acme",
        title: "Designer",
        type: "NOTE",
        occurredAt: same,
        createdAt: new Date("2026-10-22T11:00:00.000Z"),
        manual: true,
        archived: false,
      },
      {
        id: "a",
        jobId: "job",
        company: "Acme",
        title: "Designer",
        type: "NOTE",
        occurredAt: same,
        createdAt: new Date("2026-10-22T11:00:00.000Z"),
        manual: true,
        archived: false,
      },
      {
        id: "hidden",
        jobId: "old",
        company: "Old",
        title: "Role",
        type: "CREATED",
        occurredAt: new Date("2026-12-01T00:00:00.000Z"),
        createdAt: NOW,
        manual: false,
        archived: true,
      },
      ...["c", "d", "e", "f"].map((id, index) => ({
        id,
        jobId: "job",
        company: "Acme",
        title: "Designer",
        type: "APPLIED",
        occurredAt: new Date(NOW.getTime() - (index + 1) * 86_400_000),
        createdAt: NOW,
        manual: false,
        archived: false,
      })),
    ]);
    expect(items.map((item) => item.id)).toEqual(["b", "a", "c", "d", "e"]);
    expect(items[0]?.href).toBe("/jobs/job?tab=timeline");
  });
});

describe("isSpecificJobHref", () => {
  it("rejects the board, the dashboard, and a job with no tab or resume", () => {
    expect(isSpecificJobHref("/jobs")).toBe(false);
    expect(isSpecificJobHref("/dashboard")).toBe(false);
    expect(isSpecificJobHref("/jobs/abc")).toBe(false);
    expect(isSpecificJobHref("/jobs/abc?tab=")).toBe(false);
    expect(isSpecificJobHref("/jobs/abc?tab=offer")).toBe(true);
    expect(isSpecificJobHref("/jobs/abc/resumes/r")).toBe(true);
    expect(isSpecificJobHref("/jobs/abc/resumes/")).toBe(false);
  });
});
