import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserForAction, revalidatePath } = vi.hoisted(() => ({
  requireUserForAction: vi.fn(),
  revalidatePath: vi.fn(),
}));

const { userFindFirst, jobFindFirst, reminderCreate, reminderFindFirst, reminderUpdateMany } =
  vi.hoisted(() => ({
    userFindFirst: vi.fn(),
    jobFindFirst: vi.fn(),
    reminderCreate: vi.fn(),
    reminderFindFirst: vi.fn(),
    reminderUpdateMany: vi.fn(),
  }));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUserForAction }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findFirst: userFindFirst },
    reminder: { findFirst: reminderFindFirst, updateMany: reminderUpdateMany },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        job: { findFirst: jobFindFirst },
        reminder: { create: reminderCreate },
      }),
  },
}));

import { strings } from "@/copy/strings";
import { formatDeadlineLabel } from "@/features/jobs/format";
import { manualEventInstant } from "@/features/tracking/events";
import {
  compareCompletedReminders,
  compareOpenReminders,
  deadlineReminderTitle,
  isDueOrOverdue,
  isUpcomingInterview,
  presentReminder,
  snoozeDueAt,
  splitJobReminders,
  startOfNextLocalDay,
  REMINDER_LIMITS,
  SNOOZE_MS,
  UPCOMING_INTERVIEW_MS,
} from "@/features/tracking/reminders";
import {
  completeReminder,
  createCustomReminder,
  dismissReminder,
  snoozeReminder,
} from "@/features/tracking/actions";
import { createCustomReminderSchema } from "@/features/tracking/schemas";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REMINDER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ZONE = "America/Toronto";
const errors = strings.jobs.reminders.errors;

function row(partial: {
  id: string;
  dueAt: Date;
  createdAt?: Date;
  completedAt?: Date | null;
  dismissedAt?: Date | null;
}) {
  return {
    id: partial.id,
    dueAt: partial.dueAt,
    createdAt: partial.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    completedAt: partial.completedAt ?? null,
    dismissedAt: partial.dismissedAt ?? null,
  };
}

describe("startOfNextLocalDay", () => {
  it("ends the Toronto day at the next local midnight", () => {
    const evening = new Date("2026-10-22T03:30:00.000Z");
    expect(startOfNextLocalDay(evening, ZONE).toISOString()).toBe("2026-10-22T04:00:00.000Z");
    expect(isDueOrOverdue(new Date("2026-10-22T03:59:00.000Z"), evening, ZONE)).toBe(true);
    expect(isDueOrOverdue(new Date("2026-10-22T04:00:00.000Z"), evening, ZONE)).toBe(false);
  });

  it("uses standard time on the evening after the clocks fall back", () => {
    const evening = new Date("2026-11-02T04:30:00.000Z");
    expect(startOfNextLocalDay(evening, ZONE).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("uses eastern daylight time after the spring-forward morning", () => {
    const evening = new Date("2026-03-09T03:30:00.000Z");
    expect(startOfNextLocalDay(evening, ZONE).toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("uses the next UTC midnight when the zone is unknown", () => {
    const now = new Date("2026-10-22T23:30:00.000Z");
    expect(startOfNextLocalDay(now, "Not/AZone").toISOString()).toBe(
      "2026-10-23T00:00:00.000Z",
    );
  });
});

describe("isDueOrOverdue", () => {
  it("includes noon today and leaves noon tomorrow", () => {
    const morning = new Date("2026-10-22T13:00:00.000Z");
    const noonToday = manualEventInstant("2026-10-22", ZONE);
    const noonTomorrow = manualEventInstant("2026-10-23", ZONE);
    expect(isDueOrOverdue(noonToday, morning, ZONE)).toBe(true);
    expect(isDueOrOverdue(noonTomorrow, morning, ZONE)).toBe(false);
    expect(noonToday.getTime() < morning.getTime()).toBe(false);
  });
});

describe("snoozeDueAt", () => {
  it("adds exactly 24 hours across the fall-back night", () => {
    const beforeFallback = new Date("2026-11-01T05:30:00.000Z");
    const snoozed = snoozeDueAt(beforeFallback);
    expect(snoozed.getTime() - beforeFallback.getTime()).toBe(SNOOZE_MS);
    expect(snoozed.toISOString()).toBe("2026-11-02T05:30:00.000Z");
  });
});

describe("isUpcomingInterview", () => {
  const now = new Date("2026-10-22T15:00:00.000Z");

  it("includes now and the 48 hour mark, and excludes either side", () => {
    expect(isUpcomingInterview(now, now)).toBe(true);
    expect(isUpcomingInterview(new Date(now.getTime() + UPCOMING_INTERVIEW_MS), now)).toBe(true);
    expect(isUpcomingInterview(new Date(now.getTime() + UPCOMING_INTERVIEW_MS + 1), now)).toBe(
      false,
    );
    expect(isUpcomingInterview(new Date(now.getTime() - 1), now)).toBe(false);
  });
});

describe("splitJobReminders", () => {
  it("sorts open by due time and completed by the latest done time", () => {
    const early = new Date("2026-10-20T16:00:00.000Z");
    const later = new Date("2026-10-22T16:00:00.000Z");
    const same = new Date("2026-10-22T16:00:00.000Z");
    const split = splitJobReminders([
      row({ id: "b", dueAt: same, createdAt: new Date("2026-02-01T00:00:00.000Z") }),
      row({ id: "a", dueAt: same, createdAt: new Date("2026-01-01T00:00:00.000Z") }),
      row({ id: "c", dueAt: early }),
      row({
        id: "d",
        dueAt: later,
        completedAt: new Date("2026-10-01T00:00:00.000Z"),
      }),
      row({
        id: "e",
        dueAt: later,
        completedAt: new Date("2026-10-02T00:00:00.000Z"),
        dismissedAt: new Date("2026-10-03T00:00:00.000Z"),
      }),
      row({ id: "f", dueAt: later, dismissedAt: new Date("2026-10-04T00:00:00.000Z") }),
    ]);

    expect(split.open.map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(split.completed.map((item) => item.id)).toEqual(["e", "d"]);
    const firstOpen = split.open[0];
    const firstDone = split.completed[0];
    if (!firstOpen || !firstDone) throw new Error("Expected open and completed reminders.");
    expect(compareOpenReminders(firstOpen, firstOpen)).toBe(0);
    expect(compareCompletedReminders(firstDone, firstDone)).toBe(0);
  });
});

describe("presentReminder", () => {
  it("marks a past due time overdue and a future one open", () => {
    const now = new Date("2026-10-22T18:00:00.000Z");
    const shown = presentReminder(
      {
        id: REMINDER,
        kind: "CUSTOM",
        title: "Send the portfolio",
        dueAt: manualEventInstant("2026-10-22", ZONE),
        completedAt: null,
        jobId: JOB,
        jobTitle: "Editor",
        jobCompany: "Northwind",
        autoCreated: false,
      },
      now,
      ZONE,
    );
    expect(shown.overdue).toBe(true);
    expect(shown.jobLabel).toBe("Northwind · Editor");
    expect(shown.dueLabel).toBe("Oct 22, 2026");

    const later = presentReminder(
      {
        id: REMINDER,
        kind: "FOLLOW_UP",
        title: "Follow up",
        dueAt: new Date("2026-10-23T15:00:00.000Z"),
        completedAt: null,
        jobId: null,
        jobTitle: null,
        jobCompany: null,
        autoCreated: true,
      },
      now,
      ZONE,
    );
    expect(later.overdue).toBe(false);
    expect(later.jobLabel).toBeNull();
  });

  it("shows the real deadline and stays quiet until that date has passed", () => {
    const now = new Date("2026-10-22T18:00:00.000Z");
    const ahead = presentReminder(
      {
        id: REMINDER,
        kind: "DEADLINE",
        title: "Application deadline",
        dueAt: new Date("2026-10-20T00:00:00.000Z"),
        completedAt: null,
        jobId: JOB,
        jobTitle: "Editor",
        jobCompany: "Northwind",
        jobDeadline: new Date("2026-10-27T00:00:00.000Z"),
        autoCreated: true,
      },
      now,
      ZONE,
    );
    expect(ahead.title).toBe("Deadline in 3 days: Northwind");
    expect(ahead.dueLabel).toBe(formatDeadlineLabel("2026-10-27"));
    expect(ahead.overdue).toBe(false);

    const soon = presentReminder(
      {
        id: REMINDER,
        kind: "DEADLINE",
        title: "Application deadline",
        dueAt: new Date("2026-10-21T00:00:00.000Z"),
        completedAt: null,
        jobId: JOB,
        jobTitle: "Editor",
        jobCompany: "Northwind",
        jobDeadline: new Date("2026-10-24T00:00:00.000Z"),
        autoCreated: true,
      },
      now,
      ZONE,
    );
    expect(soon.overdue).toBe(false);

    const past = presentReminder(
      {
        id: REMINDER,
        kind: "DEADLINE",
        title: "Application deadline",
        dueAt: new Date("2026-10-18T00:00:00.000Z"),
        completedAt: null,
        jobId: JOB,
        jobTitle: "Editor",
        jobCompany: "Northwind",
        jobDeadline: new Date("2026-10-21T00:00:00.000Z"),
        autoCreated: true,
      },
      now,
      ZONE,
    );
    expect(past.overdue).toBe(true);
    expect(past.dueLabel).toBe(formatDeadlineLabel("2026-10-21"));
  });

  it("cuts a long company name at the title cap", () => {
    const title = deadlineReminderTitle("A".repeat(200));
    expect(title.length).toBe(REMINDER_LIMITS.title);
    expect(title.startsWith("Deadline in 3 days: ")).toBe(true);
  });
});

describe("createCustomReminderSchema", () => {
  it("trims the title and rejects an empty or over-long one", () => {
    const parsed = createCustomReminderSchema.safeParse({
      jobId: JOB,
      title: "  Send the portfolio  ",
      date: "2026-10-21",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.title).toBe("Send the portfolio");

    const blank = createCustomReminderSchema.safeParse({
      jobId: JOB,
      title: "   ",
      date: "2026-10-21",
    });
    expect(blank.success).toBe(false);
    if (!blank.success) expect(blank.error.issues[0]?.message).toBe(errors.title);

    const long = createCustomReminderSchema.safeParse({
      jobId: JOB,
      title: "a".repeat(121),
      date: "2026-02-31",
    });
    expect(long.success).toBe(false);
    if (!long.success) {
      expect(long.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([errors.titleLength, errors.date]),
      );
    }
  });
});

describe("reminder actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T15:00:00.000Z"));
    requireUserForAction.mockResolvedValue({
      id: USER,
      email: "ada@example.com",
      plan: "FREE",
      role: "USER",
    });
    userFindFirst.mockResolvedValue({ timezone: ZONE });
    jobFindFirst.mockResolvedValue({ id: JOB });
    reminderCreate.mockResolvedValue({ id: REMINDER });
    reminderFindFirst.mockResolvedValue({ jobId: JOB });
    reminderUpdateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores a custom reminder at noon for a job you own", async () => {
    const result = await createCustomReminder({
      jobId: JOB,
      title: "Send the portfolio",
      date: "2026-10-21",
    });
    expect(result).toEqual({ ok: true, data: { reminderId: REMINDER } });
    expect(reminderCreate).toHaveBeenCalledWith({
      data: {
        userId: USER,
        jobId: JOB,
        kind: "CUSTOM",
        title: "Send the portfolio",
        dueAt: manualEventInstant("2026-10-21", ZONE),
        autoCreated: false,
      },
      select: { id: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith(`/jobs/${JOB}`);
  });

  it("returns NOT_FOUND when the job is not yours", async () => {
    jobFindFirst.mockResolvedValue(null);
    const result = await createCustomReminder({
      jobId: JOB,
      title: "Send the portfolio",
      date: "2026-10-21",
    });
    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(reminderCreate).not.toHaveBeenCalled();
  });

  it("returns validation errors and does not read the database", async () => {
    const result = await createCustomReminder({ jobId: JOB, title: "", date: "nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it("marks an open reminder done", async () => {
    const result = await completeReminder({ reminderId: REMINDER });
    expect(result).toEqual({ ok: true, data: { reminderId: REMINDER } });
    expect(reminderUpdateMany).toHaveBeenCalledWith({
      where: openWhere,
      data: { completedAt: new Date("2026-10-22T15:00:00.000Z") },
    });
  });

  it("snoozes an open reminder by exactly 24 hours", async () => {
    const result = await snoozeReminder({ reminderId: REMINDER });
    expect(result.ok).toBe(true);
    expect(reminderUpdateMany).toHaveBeenCalledWith({
      where: openWhere,
      data: { dueAt: new Date("2026-10-23T15:00:00.000Z") },
    });
  });

  it("dismisses an open reminder", async () => {
    const result = await dismissReminder({ reminderId: REMINDER });
    expect(result.ok).toBe(true);
    expect(reminderUpdateMany).toHaveBeenCalledWith({
      where: openWhere,
      data: { dismissedAt: new Date("2026-10-22T15:00:00.000Z") },
    });
  });

  it("returns NOT_FOUND when the reminder is already closed", async () => {
    reminderFindFirst.mockResolvedValue(null);
    const result = await completeReminder({ reminderId: REMINDER });
    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(reminderUpdateMany).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the update loses a race", async () => {
    reminderUpdateMany.mockResolvedValue({ count: 0 });
    const result = await dismissReminder({ reminderId: REMINDER });
    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("returns UNAUTHENTICATED when nobody is signed in", async () => {
    requireUserForAction.mockResolvedValue(null);
    const result = await snoozeReminder({ reminderId: REMINDER });
    expect(result).toEqual({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });
});

const openWhere = {
  id: REMINDER,
  userId: USER,
  completedAt: null,
  dismissedAt: null,
};
