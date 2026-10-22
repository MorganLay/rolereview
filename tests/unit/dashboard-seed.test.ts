import { describe, expect, it } from "vitest";

import { dashboardNudges, thisWeek } from "@/features/dashboard/metrics";
import { isDueOrOverdue, isUpcomingInterview } from "@/features/tracking/reminders";
import { seedClock } from "../../prisma/seed-clock";

const ZONE = "America/Toronto";
const NOW = new Date("2026-10-22T15:00:00.000Z");

describe("seedClock", () => {
  const clock = seedClock(NOW, ZONE);

  it("fills the no-response nudge, a deadline, and an offer respond-by", () => {
    const nudges = dashboardNudges(
      [
        {
          id: "stale",
          company: "North Archive",
          title: "Design Researcher",
          status: "APPLIED",
          archived: false,
          appliedAt: clock.staleAppliedAt,
          deadline: null,
          respondBy: null,
        },
        {
          id: "saved",
          company: "Lakeshore Civic",
          title: "Product Designer",
          status: "SAVED",
          archived: false,
          appliedAt: null,
          deadline: clock.deadline.toISOString().slice(0, 10),
          respondBy: null,
        },
        {
          id: "offer",
          company: "Harbour Light",
          title: "Senior Product Designer",
          status: "OFFER",
          archived: false,
          appliedAt: null,
          deadline: null,
          respondBy: clock.respondBy.toISOString().slice(0, 10),
        },
      ],
      NOW,
      ZONE,
    );
    expect(nudges.map((item) => item.kind)).toEqual([
      "noResponse",
      "deadline",
      "offer",
    ]);
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
