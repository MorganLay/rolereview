import { describe, expect, it } from "vitest";

import { JobEventType } from "@/generated/prisma/enums";
import { calendarDateInTimeZone } from "@/features/jobs/dates";
import { strings } from "@/copy/strings";
import {
  compareTimelineEvents,
  formatEventWhen,
  isManualEventType,
  MANUAL_EVENT_TYPES,
  manualEventInstant,
  presentTimelineEvent,
  visibleTimelineEvents,
} from "@/features/tracking/events";
import {
  createTimelineEventSchema,
  updateTimelineEventSchema,
} from "@/features/tracking/schemas";

const JOB_ID = "00000000-0000-4000-8000-000000000001";
const EVENT_ID = "00000000-0000-4000-8000-000000000002";
const errors = strings.jobs.timeline.errors;

function entry(partial: {
  jobId?: string;
  type?: string;
  date?: string;
  details?: string;
  eventId?: string;
}) {
  return {
    jobId: JOB_ID,
    type: "NOTE",
    date: "2026-10-21",
    details: "Left a voicemail.",
    ...partial,
  };
}

describe("isManualEventType", () => {
  it("treats follow-up, call, email, note, and other as manual", () => {
    for (const type of Object.values(JobEventType)) {
      expect(isManualEventType(type)).toBe(
        (MANUAL_EVENT_TYPES as readonly string[]).includes(type),
      );
    }
  });
});

describe("compareTimelineEvents", () => {
  const older = new Date("2026-01-01T12:00:00.000Z");
  const newer = new Date("2026-02-01T12:00:00.000Z");

  it("puts the later occurredAt first", () => {
    const first = { occurredAt: newer, createdAt: older, id: "a" };
    const second = { occurredAt: older, createdAt: newer, id: "b" };
    expect(compareTimelineEvents(first, second)).toBeLessThan(0);
    expect([second, first].sort(compareTimelineEvents).map((row) => row.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("uses createdAt when the occurredAt matches", () => {
    const first = { occurredAt: older, createdAt: newer, id: "a" };
    const second = { occurredAt: older, createdAt: older, id: "b" };
    expect([second, first].sort(compareTimelineEvents).map((row) => row.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("uses id descending when both times match", () => {
    const first = { occurredAt: older, createdAt: older, id: "b" };
    const second = { occurredAt: older, createdAt: older, id: "a" };
    expect([second, first].sort(compareTimelineEvents).map((row) => row.id)).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("visibleTimelineEvents", () => {
  const events = [
    { id: "auto", manual: false },
    { id: "note", manual: true },
  ];

  it("keeps every event until automatic ones are hidden", () => {
    expect(visibleTimelineEvents(events, false).map((event) => event.id)).toEqual([
      "auto",
      "note",
    ]);
    expect(visibleTimelineEvents(events, true).map((event) => event.id)).toEqual(["note"]);
  });

  it("returns an empty list when only automatic events are hidden", () => {
    expect(visibleTimelineEvents([{ id: "auto", manual: false }], true)).toEqual([]);
  });
});

describe("manualEventInstant", () => {
  it("stores noon in the user's timezone", () => {
    expect(manualEventInstant("2026-01-15", "America/Toronto").toISOString()).toBe(
      "2026-01-15T17:00:00.000Z",
    );
    expect(manualEventInstant("2026-07-15", "America/Toronto").toISOString()).toBe(
      "2026-07-15T16:00:00.000Z",
    );
    expect(manualEventInstant("2026-01-15", "America/St_Johns").toISOString()).toBe(
      "2026-01-15T15:30:00.000Z",
    );
    expect(manualEventInstant("2026-01-15", "Asia/Tokyo").toISOString()).toBe(
      "2026-01-15T03:00:00.000Z",
    );
    expect(manualEventInstant("2026-03-01", "UTC").toISOString()).toBe(
      "2026-03-01T12:00:00.000Z",
    );
  });

  it("uses noon UTC when the timezone is unknown", () => {
    expect(manualEventInstant("2026-03-01", "Not/AZone").toISOString()).toBe(
      "2026-03-01T12:00:00.000Z",
    );
    expect(manualEventInstant("2026-03-01", " ").toISOString()).toBe(
      "2026-03-01T12:00:00.000Z",
    );
  });

  it("round-trips to the same calendar date", () => {
    for (const zone of ["America/Toronto", "America/St_Johns", "Asia/Tokyo", "UTC"]) {
      const instant = manualEventInstant("2026-01-15", zone);
      expect(calendarDateInTimeZone(instant, zone)).toBe("2026-01-15");
    }
  });
});

describe("formatEventWhen", () => {
  const noonToronto = new Date("2026-01-15T17:00:00.000Z");

  it("shows a date for a manual entry and a time for an automatic one", () => {
    expect(formatEventWhen(noonToronto, "America/Toronto", true)).toBe("Jan 15, 2026");
    expect(formatEventWhen(noonToronto, "America/Toronto", false)).toBe(
      "Jan 15, 2026, 12:00 p.m.",
    );
  });

  it("falls back to UTC when the timezone is unknown", () => {
    expect(formatEventWhen(noonToronto, "Not/AZone", false)).toBe(
      "Jan 15, 2026, 5:00 p.m.",
    );
  });
});

describe("presentTimelineEvent", () => {
  it("marks manual types and formats the label in the user's timezone", () => {
    const view = presentTimelineEvent(
      {
        id: EVENT_ID,
        type: "NOTE",
        fromStatus: null,
        toStatus: null,
        details: "Called.",
        occurredAt: new Date("2026-01-15T17:00:00.000Z"),
      },
      "America/Toronto",
    );
    expect(view.manual).toBe(true);
    expect(view.date).toBe("2026-01-15");
    expect(view.whenLabel).toBe("Jan 15, 2026");
    expect(view.occurredAt).toBe("2026-01-15T17:00:00.000Z");
  });

  it("keeps status ends on an automatic event", () => {
    const view = presentTimelineEvent(
      {
        id: EVENT_ID,
        type: "STATUS_CHANGED",
        fromStatus: "SAVED",
        toStatus: "APPLIED",
        details: null,
        occurredAt: new Date("2026-01-15T17:04:00.000Z"),
      },
      "America/Toronto",
    );
    expect(view.manual).toBe(false);
    expect(view.fromStatus).toBe("SAVED");
    expect(view.toStatus).toBe("APPLIED");
    expect(view.whenLabel).toBe("Jan 15, 2026, 12:04 p.m.");
  });
});

describe("createTimelineEventSchema", () => {
  it("trims details and accepts a manual type", () => {
    const parsed = createTimelineEventSchema.safeParse(
      entry({ details: "  Called back.  ", type: "FOLLOW_UP_SENT" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.details).toBe("Called back.");
      expect(parsed.data.type).toBe("FOLLOW_UP_SENT");
    }
  });

  it("rejects a blank, a too-long note, a bad date, and an automatic type", () => {
    expect(createTimelineEventSchema.safeParse(entry({ details: "   " })).success).toBe(
      false,
    );
    expect(
      createTimelineEventSchema.safeParse(entry({ details: "a".repeat(2000) })).success,
    ).toBe(true);
    const tooLong = createTimelineEventSchema.safeParse(
      entry({ details: "a".repeat(2001) }),
    );
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(tooLong.error.issues.some((issue) => issue.message === errors.detailsLength)).toBe(
        true,
      );
    }
    const badDate = createTimelineEventSchema.safeParse(entry({ date: "2026-02-31" }));
    expect(badDate.success).toBe(false);
    if (!badDate.success) {
      expect(badDate.error.issues.some((issue) => issue.message === errors.date)).toBe(true);
    }
    expect(
      createTimelineEventSchema.safeParse(entry({ date: "1899-12-31" })).success,
    ).toBe(false);
    const auto = createTimelineEventSchema.safeParse(entry({ type: "STATUS_CHANGED" }));
    expect(auto.success).toBe(false);
    if (!auto.success) {
      expect(auto.error.issues.some((issue) => issue.message === errors.type)).toBe(true);
    }
  });
});

describe("updateTimelineEventSchema", () => {
  it("requires the event id", () => {
    expect(updateTimelineEventSchema.safeParse(entry({})).success).toBe(false);
    const parsed = updateTimelineEventSchema.safeParse(entry({ eventId: EVENT_ID }));
    expect(parsed.success).toBe(true);
  });
});
