import { describe, expect, it } from "vitest";

import { thisWeek } from "@/features/dashboard/metrics";
import {
  continueWorking,
  dashboardActions,
  dashboardSummary,
  isSpecificJobHref,
  type HomeJob,
} from "@/features/dashboard/priorities";
import { isDueOrOverdue, isUpcomingInterview } from "@/features/tracking/reminders";
import { seedClock } from "../../prisma/seed-clock";

const ZONE = "America/Toronto";
const NOW = new Date("2026-10-22T15:00:00.000Z");

function job(partial: Partial<HomeJob> & Pick<HomeJob, "id">): HomeJob {
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

describe("seedClock", () => {
  const clock = seedClock(NOW, ZONE);

  it("puts the interview first, ahead of the offer, the deadline, and undated work", () => {
    const actions = dashboardActions(
      [
        job({
          id: "saved",
          company: "Lakeshore Civic",
          title: "Product Designer",
          status: "SAVED",
          deadline: clock.deadline.toISOString().slice(0, 10),
          updatedAt: clock.updated.saved,
          reminders: [
            {
              id: "deadline",
              kind: "DEADLINE",
              title: "Deadline in 3 days: Lakeshore Civic",
              dueAt: clock.dueToday,
              open: true,
            },
          ],
        }),
        job({
          id: "stale",
          company: "North Archive",
          title: "Design Researcher",
          status: "APPLIED",
          appliedAt: clock.staleAppliedAt,
          updatedAt: clock.updated.stale,
        }),
        job({
          id: "applied",
          company: "Bright Path",
          title: "Product Designer",
          status: "APPLIED",
          appliedAt: clock.appliedThisWeek,
          updatedAt: clock.updated.applied,
          reminders: [
            {
              id: "follow",
              kind: "FOLLOW_UP",
              title: "Follow up on your application",
              dueAt: clock.dueFollowUp,
              open: true,
            },
          ],
        }),
        job({
          id: "screening",
          company: "Harbour & Field",
          title: "UX Designer",
          status: "SCREENING",
          updatedAt: clock.updated.screening,
          reminders: [
            {
              id: "portfolio",
              kind: "CUSTOM",
              title: "Send the portfolio",
              dueAt: clock.dueLater,
              open: true,
            },
          ],
        }),
        job({
          id: "interviewing",
          company: "Civic Studio",
          title: "Product Designer",
          status: "INTERVIEWING",
          updatedAt: clock.updated.interviewing,
          interviews: [
            {
              id: "soon",
              round: 1,
              kind: "HIRING_MANAGER",
              scheduledAt: clock.interviewSoon,
            },
            {
              id: "past",
              round: 2,
              kind: "PANEL",
              scheduledAt: clock.interviewPast,
            },
          ],
          resumes: [
            {
              id: "draft",
              version: 1,
              exported: false,
              submitted: false,
              updatedAt: new Date(NOW.getTime() - 5 * 60 * 1000),
            },
          ],
        }),
        job({
          id: "offer",
          company: "Harbour Light",
          title: "Senior Product Designer",
          status: "OFFER",
          hasOffer: true,
          respondBy: clock.respondBy.toISOString().slice(0, 10),
          updatedAt: clock.updated.offer,
          reminders: [
            {
              id: "respond",
              kind: "OFFER_RESPONSE",
              title: "Respond to the offer",
              dueAt: clock.dueToday,
              open: true,
            },
          ],
        }),
        job({
          id: "accepted",
          status: "ACCEPTED",
          updatedAt: clock.updated.accepted,
        }),
        job({
          id: "archived",
          archived: true,
          deadline: "2026-10-01",
          reminders: [
            {
              id: "old",
              kind: "DEADLINE",
              title: "Deadline",
              dueAt: clock.dueToday,
              open: true,
            },
          ],
        }),
      ],
      NOW,
      ZONE,
    );

    expect(actions[0]).toMatchObject({
      kind: "interview",
      jobId: "interviewing",
      href: "/jobs/interviewing?tab=interviews",
    });
    expect(actions[0]?.sortAt).not.toBeNull();
    expect(actions.map((item) => `${item.kind}:${item.jobId}`)).toEqual([
      "interview:interviewing",
      "offer:offer",
      "deadline:saved",
      "followUp:screening",
      "followUp:applied",
      "followUp:stale",
      "document:interviewing",
    ]);
    expect(actions.every((item) => isSpecificJobHref(item.href))).toBe(true);
    expect(
      dashboardSummary(
        [
          job({ id: "saved", status: "SAVED" }),
          job({ id: "stale", status: "APPLIED" }),
          job({ id: "applied", status: "APPLIED" }),
          job({ id: "screening", status: "SCREENING" }),
          job({
            id: "interviewing",
            status: "INTERVIEWING",
            interviews: [
              {
                id: "soon",
                round: 1,
                kind: "HIRING_MANAGER",
                scheduledAt: clock.interviewSoon,
              },
            ],
          }),
          job({ id: "offer", status: "OFFER" }),
          job({ id: "accepted", status: "ACCEPTED" }),
          job({ id: "rejected", status: "REJECTED" }),
        ],
        dashboardActions(
          [
            job({ id: "saved", status: "SAVED" }),
            job({ id: "stale", status: "APPLIED" }),
            job({ id: "applied", status: "APPLIED" }),
            job({ id: "screening", status: "SCREENING" }),
            job({
              id: "interviewing",
              status: "INTERVIEWING",
              interviews: [
                {
                  id: "soon",
                  round: 1,
                  kind: "HIRING_MANAGER",
                  scheduledAt: clock.interviewSoon,
                },
              ],
            }),
            job({ id: "offer", status: "OFFER" }),
            job({ id: "accepted", status: "ACCEPTED" }),
            job({ id: "rejected", status: "REJECTED" }),
          ],
          NOW,
          ZONE,
        ),
      ),
    ).toEqual({
      active: 6,
      interviews: 1,
      offers: 1,
      urgent: 1,
    });

    expect(
      continueWorking([
        job({
          id: "offer",
          status: "OFFER",
          hasOffer: true,
          updatedAt: clock.updated.offer,
        }),
        job({
          id: "interviewing",
          status: "INTERVIEWING",
          updatedAt: clock.updated.interviewing,
          resumes: [
            {
              id: "draft",
              version: 1,
              exported: false,
              submitted: false,
              updatedAt: new Date(NOW.getTime() - 5 * 60 * 1000),
            },
          ],
        }),
      ])?.href,
    ).toBe("/jobs/interviewing/resumes/draft");
  });

  it("counts one application and one response in this week", () => {
    expect(
      thisWeek(
        [
          {
            archived: false,
            appliedAt: clock.appliedThisWeek,
            firstResponseAt: null,
            submittedResumeId: "resume",
          },
          {
            archived: false,
            appliedAt: clock.screeningAppliedAt,
            firstResponseAt: clock.responseThisWeek,
            submittedResumeId: null,
          },
        ],
        NOW,
        ZONE,
      ),
    ).toEqual({ applications: 1, tailoredPercent: 100, responses: 1 });
  });

  it("puts two reminders on today, and the interview inside 48 hours", () => {
    expect(isDueOrOverdue(clock.dueToday, NOW, ZONE)).toBe(true);
    expect(isDueOrOverdue(clock.dueLater, NOW, ZONE)).toBe(false);
    expect(isDueOrOverdue(clock.dueFollowUp, NOW, ZONE)).toBe(false);
    expect(isUpcomingInterview(clock.interviewSoon, NOW)).toBe(true);
    expect(clock.interviewPast.getTime()).toBeLessThan(NOW.getTime());
  });
});
