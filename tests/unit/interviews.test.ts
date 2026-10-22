import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import type { JobStatus } from "@/generated/prisma/enums";
import {
  INTERVIEW_LEAD_MS,
  THANK_YOU_LEAD_MS,
  compareInterviews,
  formatInterviewLocal,
  isInterviewLink,
  isZonedDateTime,
  nextInterviewRound,
  planInterviewEffects,
  presentInterview,
  zonedDateTimeInstant,
  type InterviewMoment,
} from "@/features/tracking/interviews";
import {
  createInterviewSchema,
  deleteInterviewSchema,
  updateInterviewSchema,
} from "@/features/tracking/schemas";

const errors = strings.jobs.interviews.errors;
const JOB_ID = "00000000-0000-4000-8000-000000000001";
const INTERVIEW_ID = "00000000-0000-4000-8000-000000000002";
const ZONE = "America/Toronto";

const UNDATED: InterviewMoment = { scheduledAt: null, outcome: "PENDING" };

function plan(partial: {
  previous?: InterviewMoment;
  next?: InterviewMoment;
  status?: JobStatus;
  now?: Date;
  timeZone?: string;
  alreadyScheduled?: boolean;
  alreadyCompleted?: boolean;
}) {
  return planInterviewEffects({
    previous: partial.previous ?? UNDATED,
    next: partial.next ?? {
      scheduledAt: new Date("2026-10-28T18:00:00.000Z"),
      outcome: "PENDING",
    },
    status: partial.status ?? "SAVED",
    now: partial.now ?? new Date("2026-10-21T16:00:00.000Z"),
    timeZone: partial.timeZone ?? ZONE,
    alreadyScheduled: partial.alreadyScheduled ?? false,
    alreadyCompleted: partial.alreadyCompleted ?? false,
  });
}

describe("zonedDateTimeInstant", () => {
  it("reads a wall clock in the user timezone", () => {
    const instant = zonedDateTimeInstant("2026-10-21T15:04", ZONE);
    expect(instant?.toISOString()).toBe("2026-10-21T19:04:00.000Z");
    expect(formatInterviewLocal(instant!, ZONE)).toBe("2026-10-21T15:04");
  });

  it("keeps midnight on the same calendar date", () => {
    const instant = zonedDateTimeInstant("2026-10-21T00:00", ZONE);
    expect(instant?.toISOString()).toBe("2026-10-21T04:00:00.000Z");
    expect(formatInterviewLocal(instant!, ZONE)).toBe("2026-10-21T00:00");
  });

  it("rejects a spring-forward gap and accepts the next real hour", () => {
    expect(zonedDateTimeInstant("2026-03-08T02:30", ZONE)).toBeNull();
    expect(zonedDateTimeInstant("2026-03-08T03:30", ZONE)?.toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
  });

  it("uses the earlier instant for a repeated fall-back hour", () => {
    expect(zonedDateTimeInstant("2026-11-01T01:30", ZONE)?.toISOString()).toBe(
      "2026-11-01T05:30:00.000Z",
    );
  });

  it("reads an unknown zone as UTC", () => {
    expect(zonedDateTimeInstant("2026-10-21T15:00", "Not/AZone")?.toISOString()).toBe(
      "2026-10-21T15:00:00.000Z",
    );
  });

  it("rejects an impossible calendar day", () => {
    expect(isZonedDateTime("2026-02-31T10:00")).toBe(false);
    expect(isZonedDateTime("2026-10-21T24:00")).toBe(false);
    expect(zonedDateTimeInstant("2026-02-31T10:00", ZONE)).toBeNull();
  });
});

describe("planInterviewEffects", () => {
  it("schedules, reminds 24 hours ahead, and advances an early status", () => {
    for (const status of ["SAVED", "APPLIED", "SCREENING"] as const) {
      const next = {
        scheduledAt: new Date("2026-10-28T18:00:00.000Z"),
        outcome: "PENDING" as const,
      };
      const result = plan({ status, next });
      expect(result.scheduleEvent).toBe(true);
      expect(result.advanceToInterviewing).toBe(true);
      expect(result.interviewReminder).toBe("upsert");
      expect(result.interviewReminderDueAt?.toISOString()).toBe("2026-10-27T18:00:00.000Z");
      expect(result.completeEvent).toBe(false);
      expect(result.thankYouDueAt).toBeNull();
    }
  });

  it("leaves Interviewing, Offer, Accepted, and closed statuses where they are", () => {
    for (const status of [
      "INTERVIEWING",
      "OFFER",
      "ACCEPTED",
      "REJECTED",
      "WITHDRAWN",
      "NO_RESPONSE",
    ] as const) {
      expect(plan({ status }).advanceToInterviewing).toBe(false);
      expect(plan({ status }).scheduleEvent).toBe(true);
    }
  });

  it("skips the schedule effects when there is no date", () => {
    const result = plan({ next: UNDATED });
    expect(result.scheduleEvent).toBe(false);
    expect(result.advanceToInterviewing).toBe(false);
    expect(result.interviewReminder).toBe("keep");
    expect(result.interviewReminderDueAt).toBeNull();
  });

  it("writes a thank-you when the outcome is first set on today's date", () => {
    const now = new Date("2026-10-22T03:30:00.000Z");
    const result = plan({
      now,
      next: {
        scheduledAt: new Date("2026-10-22T01:00:00.000Z"),
        outcome: "ADVANCED",
      },
    });
    expect(result.completeEvent).toBe(true);
    expect(result.thankYouDueAt?.toISOString()).toBe(
      new Date(now.getTime() + THANK_YOU_LEAD_MS).toISOString(),
    );
  });

  it("skips the thank-you when the interview was the previous local day", () => {
    const now = new Date("2026-10-22T03:30:00.000Z");
    const yesterday = plan({
      now,
      next: {
        scheduledAt: new Date("2026-10-21T03:00:00.000Z"),
        outcome: "ADVANCED",
      },
    });
    expect(yesterday.completeEvent).toBe(true);
    expect(yesterday.thankYouDueAt).toBeNull();

    const afterMidnight = plan({
      now: new Date("2026-10-22T04:30:00.000Z"),
      next: {
        scheduledAt: new Date("2026-10-22T01:00:00.000Z"),
        outcome: "REJECTED",
      },
    });
    expect(afterMidnight.completeEvent).toBe(true);
    expect(afterMidnight.thankYouDueAt).toBeNull();
  });

  it("completes an undated interview without a thank-you", () => {
    const result = plan({
      next: { scheduledAt: null, outcome: "CANCELLED" },
    });
    expect(result.completeEvent).toBe(true);
    expect(result.thankYouDueAt).toBeNull();
    expect(result.scheduleEvent).toBe(false);
  });

  it("stays quiet when the outcome changes again", () => {
    const again = plan({
      previous: {
        scheduledAt: new Date("2026-10-22T01:00:00.000Z"),
        outcome: "ADVANCED",
      },
      next: {
        scheduledAt: new Date("2026-10-22T01:00:00.000Z"),
        outcome: "REJECTED",
      },
      alreadyScheduled: true,
    });
    expect(again.completeEvent).toBe(false);
    expect(again.thankYouDueAt).toBeNull();
    expect(again.scheduleEvent).toBe(false);
    expect(again.interviewReminder).toBe("keep");

    const returned = plan({
      previous: UNDATED,
      next: { scheduledAt: null, outcome: "ADVANCED" },
      alreadyCompleted: true,
    });
    expect(returned.completeEvent).toBe(false);
  });

  it("moves the reminder when the date changes and does not add another event", () => {
    const nextAt = new Date("2026-11-02T15:00:00.000Z");
    const result = plan({
      previous: {
        scheduledAt: new Date("2026-10-28T18:00:00.000Z"),
        outcome: "PENDING",
      },
      next: { scheduledAt: nextAt, outcome: "PENDING" },
      alreadyScheduled: true,
      status: "INTERVIEWING",
    });
    expect(result.scheduleEvent).toBe(false);
    expect(result.advanceToInterviewing).toBe(false);
    expect(result.interviewReminder).toBe("upsert");
    expect(result.interviewReminderDueAt?.getTime()).toBe(nextAt.getTime() - INTERVIEW_LEAD_MS);
  });

  it("leaves the reminder when the instant does not change", () => {
    const at = new Date("2026-10-28T18:00:00.000Z");
    const result = plan({
      previous: { scheduledAt: at, outcome: "PENDING" },
      next: { scheduledAt: new Date(at.getTime()), outcome: "PENDING" },
      alreadyScheduled: true,
    });
    expect(result.interviewReminder).toBe("keep");
    expect(result.scheduleEvent).toBe(false);
  });

  it("dismisses the open reminder when the date is cleared", () => {
    const result = plan({
      previous: {
        scheduledAt: new Date("2026-10-28T18:00:00.000Z"),
        outcome: "PENDING",
      },
      next: UNDATED,
      alreadyScheduled: true,
    });
    expect(result.interviewReminder).toBe("dismiss");
    expect(result.scheduleEvent).toBe(false);
    expect(result.advanceToInterviewing).toBe(false);
  });

  it("does not write a second scheduled event when a cleared date is set again", () => {
    const result = plan({
      previous: UNDATED,
      next: {
        scheduledAt: new Date("2026-11-04T19:00:00.000Z"),
        outcome: "PENDING",
      },
      alreadyScheduled: true,
      status: "SCREENING",
    });
    expect(result.scheduleEvent).toBe(false);
    expect(result.advanceToInterviewing).toBe(false);
    expect(result.interviewReminder).toBe("upsert");
  });

  it("uses a 24-hour lead across the spring-forward change", () => {
    const scheduledAt = zonedDateTimeInstant("2026-03-08T10:00", ZONE);
    expect(scheduledAt?.toISOString()).toBe("2026-03-08T14:00:00.000Z");
    const result = plan({
      next: { scheduledAt, outcome: "PENDING" },
    });
    expect(result.interviewReminderDueAt?.toISOString()).toBe("2026-03-07T14:00:00.000Z");
    expect(formatInterviewLocal(result.interviewReminderDueAt!, ZONE)).toBe(
      "2026-03-07T09:00",
    );
  });
});

describe("compareInterviews", () => {
  it("orders by round, then time, with undated interviews last in the round", () => {
    const rows = [
      row("b", 1, null, "2026-10-01T00:00:00.000Z"),
      row("c", 2, "2026-10-03T00:00:00.000Z", "2026-10-01T00:00:00.000Z"),
      row("a", 1, "2026-10-05T00:00:00.000Z", "2026-10-02T00:00:00.000Z"),
      row("d", 1, "2026-10-04T00:00:00.000Z", "2026-10-02T00:00:00.000Z"),
    ];
    expect([...rows].sort(compareInterviews).map((item) => item.id)).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
  });
});

describe("presentInterview", () => {
  it("marks a past interview and a meeting link", () => {
    const view = presentInterview(
      {
        ...row("a", 1, "2026-10-21T15:00:00.000Z", "2026-10-01T00:00:00.000Z"),
        kind: "TECHNICAL",
        outcome: "PENDING",
        durationMinutes: 45,
        locationOrLink: "https://meet.example/room",
        interviewers: "Ada",
        prepNotes: "Review the posting.",
        reflection: null,
      },
      ZONE,
      new Date("2026-10-21T16:00:00.000Z"),
    );
    expect(view.past).toBe(true);
    expect(view.link).toBe(true);
    expect(view.scheduledLocal).toBe("2026-10-21T11:00");
    expect(view.whenLabel).toContain("2026");
  });

  it("leaves a room name as text", () => {
    expect(isInterviewLink("Room 4")).toBe(false);
    expect(isInterviewLink("javascript:alert(1)")).toBe(false);
  });
});

describe("nextInterviewRound", () => {
  it("suggests the next round inside 1–20", () => {
    expect(nextInterviewRound([])).toBe(1);
    expect(nextInterviewRound([1, 3])).toBe(4);
    expect(nextInterviewRound([20])).toBe(20);
  });
});

describe("interview schemas", () => {
  it("accepts a blank date and duration", () => {
    const parsed = createInterviewSchema.safeParse(entry({}));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.scheduledAt).toBe("");
    expect(parsed.data.durationMinutes).toBeNull();
    expect(parsed.data.locationOrLink).toBeNull();
    expect(parsed.data.outcome).toBe("PENDING");
  });

  it("rejects a round, duration, kind, or note outside the caps", () => {
    expect(field(createInterviewSchema.safeParse(entry({ round: "0" })), "round")).toBe(
      errors.round,
    );
    expect(field(createInterviewSchema.safeParse(entry({ round: "21" })), "round")).toBe(
      errors.round,
    );
    expect(
      field(createInterviewSchema.safeParse(entry({ durationMinutes: "0" })), "durationMinutes"),
    ).toBe(errors.duration);
    expect(
      field(createInterviewSchema.safeParse(entry({ durationMinutes: "481" })), "durationMinutes"),
    ).toBe(errors.duration);
    expect(field(createInterviewSchema.safeParse(entry({ kind: "CHAT" })), "kind")).toBe(
      errors.kind,
    );
    expect(
      field(
        createInterviewSchema.safeParse(entry({ prepNotes: "x".repeat(5_001) })),
        "prepNotes",
      ),
    ).toBe(errors.prepNotesLength);
    expect(
      field(
        updateInterviewSchema.safeParse(
          entry({ interviewId: INTERVIEW_ID, reflection: "x".repeat(5_001) }),
        ),
        "reflection",
      ),
    ).toBe(errors.reflectionLength);
    expect(
      field(createInterviewSchema.safeParse(entry({ scheduledAt: "2026-02-31T10:00" })), "scheduledAt"),
    ).toBe(errors.dateTime);
  });

  it("requires an interview id to delete", () => {
    const parsed = deleteInterviewSchema.safeParse({
      jobId: JOB_ID,
      interviewId: INTERVIEW_ID,
    });
    expect(parsed.success).toBe(true);
    expect(deleteInterviewSchema.safeParse({ jobId: JOB_ID }).success).toBe(false);
  });
});

function entry(partial: Record<string, string>) {
  return {
    jobId: JOB_ID,
    round: "2",
    kind: "TECHNICAL",
    scheduledAt: "",
    durationMinutes: "",
    locationOrLink: "  ",
    interviewers: "",
    prepNotes: "",
    reflection: "",
    outcome: "PENDING",
    ...partial,
  };
}

function field(
  parsed: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  key: string,
): string | undefined {
  if (parsed.success || !parsed.error) return undefined;
  return parsed.error.issues.find((issue) => issue.path.join(".") === key)?.message;
}

function row(id: string, round: number, scheduledAt: string | null, createdAt: string) {
  return {
    id,
    round,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    createdAt: new Date(createdAt),
    kind: "TECHNICAL" as const,
    outcome: "PENDING" as const,
    durationMinutes: null,
    locationOrLink: null,
    interviewers: null,
    prepNotes: null,
    reflection: null,
  };
}
