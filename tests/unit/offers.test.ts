import { describe, expect, it } from "vitest";

import { deadlineInstant } from "@/features/jobs/dates";
import type { JobStatus } from "@/generated/prisma/enums";
import {
  offerResponseDue,
  offerTabVisible,
  planOfferEffects,
  presentOffer,
  type OfferRow,
} from "@/features/tracking/offers";
import { saveOfferSchema } from "@/features/tracking/schemas";

const JOB_ID = "00000000-0000-4000-8000-000000000001";

function plan(partial: {
  creating?: boolean;
  status?: JobStatus;
  previousRespondBy?: Date | null;
  nextRespondBy?: Date | null;
}) {
  return planOfferEffects({
    creating: partial.creating ?? true,
    status: partial.status ?? "APPLIED",
    previousRespondBy: partial.previousRespondBy ?? null,
    nextRespondBy: partial.nextRespondBy === undefined ? null : partial.nextRespondBy,
  });
}

describe("offerResponseDue", () => {
  it("is two calendar days before a date that crosses a month boundary", () => {
    const respondBy = deadlineInstant("2026-03-01");
    expect(offerResponseDue(respondBy).toISOString()).toBe("2026-02-27T00:00:00.000Z");
  });

  it("keeps UTC midnight across a leap-day February", () => {
    expect(offerResponseDue(deadlineInstant("2024-03-01")).toISOString()).toBe(
      "2024-02-28T00:00:00.000Z",
    );
  });
});

describe("planOfferEffects", () => {
  it.each(["SAVED", "APPLIED", "SCREENING", "INTERVIEWING"] as const)(
    "moves %s to Offer on the first save",
    (status) => {
      const effect = plan({ status, nextRespondBy: deadlineInstant("2026-03-01") });
      expect(effect.receivedEvent).toBe(true);
      expect(effect.advanceToOffer).toBe(true);
      expect(effect.reminder).toBe("upsert");
      expect(effect.reminderDueAt?.toISOString()).toBe("2026-02-27T00:00:00.000Z");
    },
  );

  it.each(["OFFER", "ACCEPTED", "REJECTED", "WITHDRAWN", "NO_RESPONSE"] as const)(
    "leaves %s where it is",
    (status) => {
      const effect = plan({ status });
      expect(effect.advanceToOffer).toBe(false);
      expect(effect.receivedEvent).toBe(true);
      expect(effect.reminder).toBe("keep");
    },
  );

  it("does not write a second offer event or move status on a later save", () => {
    const effect = plan({
      creating: false,
      status: "APPLIED",
      previousRespondBy: deadlineInstant("2026-04-10"),
      nextRespondBy: deadlineInstant("2026-04-10"),
    });
    expect(effect.receivedEvent).toBe(false);
    expect(effect.advanceToOffer).toBe(false);
    expect(effect.reminder).toBe("keep");
    expect(effect.reminderDueAt).toBeNull();
  });

  it("moves the open reminder when the respond-by date changes", () => {
    const effect = plan({
      creating: false,
      status: "OFFER",
      previousRespondBy: deadlineInstant("2026-03-01"),
      nextRespondBy: deadlineInstant("2026-03-05"),
    });
    expect(effect.reminder).toBe("upsert");
    expect(effect.reminderDueAt?.toISOString()).toBe("2026-03-03T00:00:00.000Z");
    expect(effect.receivedEvent).toBe(false);
  });

  it("dismisses the open reminder when respond-by is cleared", () => {
    const effect = plan({
      creating: false,
      status: "OFFER",
      previousRespondBy: deadlineInstant("2026-03-01"),
      nextRespondBy: null,
    });
    expect(effect.reminder).toBe("dismiss");
    expect(effect.reminderDueAt).toBeNull();
    expect(effect.receivedEvent).toBe(false);
    expect(effect.advanceToOffer).toBe(false);
  });

  it("creates no reminder when the first save has no respond-by date", () => {
    const effect = plan({ nextRespondBy: null });
    expect(effect.reminder).toBe("keep");
    expect(effect.reminderDueAt).toBeNull();
  });
});

describe("offerTabVisible", () => {
  it("shows the tab for Offer, Accepted, a saved offer, or the offer URL", () => {
    expect(offerTabVisible({ status: "SAVED", hasOffer: false, tab: null })).toBe(false);
    expect(offerTabVisible({ status: "OFFER", hasOffer: false, tab: "overview" })).toBe(
      true,
    );
    expect(offerTabVisible({ status: "ACCEPTED", hasOffer: false, tab: null })).toBe(true);
    expect(offerTabVisible({ status: "REJECTED", hasOffer: true, tab: "timeline" })).toBe(
      true,
    );
    expect(offerTabVisible({ status: "SAVED", hasOffer: false, tab: "offer" })).toBe(true);
  });
});

describe("presentOffer", () => {
  it("turns stored dates and blanks into form values", () => {
    const row: OfferRow = {
      id: "offer-1",
      baseSalary: 120000,
      currency: "CAD",
      payPeriod: "YEAR",
      bonus: null,
      equity: null,
      benefits: null,
      startDate: deadlineInstant("2026-06-01"),
      respondBy: deadlineInstant("2026-03-01"),
      decision: "PENDING",
      notes: null,
    };
    expect(presentOffer(row)).toMatchObject({
      baseSalary: "120000",
      currency: "CAD",
      payPeriod: "YEAR",
      bonus: "",
      startDate: "2026-06-01",
      respondBy: "2026-03-01",
      decision: "PENDING",
      notes: "",
    });
  });
});

describe("saveOfferSchema", () => {
  const valid = {
    jobId: JOB_ID,
    baseSalary: "",
    currency: "",
    payPeriod: "NONE",
    bonus: "",
    equity: "",
    benefits: "",
    startDate: "",
    respondBy: "",
    decision: "PENDING",
    notes: "",
  };

  it("stores blanks as null and uppercases currency", () => {
    const parsed = saveOfferSchema.parse({
      ...valid,
      baseSalary: "90000",
      currency: " cad ",
      payPeriod: "YEAR",
      respondBy: "2026-03-01",
    });
    expect(parsed.baseSalary).toBe(90000);
    expect(parsed.currency).toBe("CAD");
    expect(parsed.payPeriod).toBe("YEAR");
    expect(parsed.bonus).toBeNull();
    expect(parsed.respondBy?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(parsed.startDate).toBeNull();
  });

  it("rejects a salary, currency, or date that is out of range", () => {
    expect(saveOfferSchema.safeParse({ ...valid, baseSalary: "2147483648" }).success).toBe(
      false,
    );
    expect(saveOfferSchema.safeParse({ ...valid, baseSalary: "12.5" }).success).toBe(false);
    expect(saveOfferSchema.safeParse({ ...valid, currency: "CA" }).success).toBe(false);
    expect(saveOfferSchema.safeParse({ ...valid, respondBy: "2026-02-31" }).success).toBe(
      false,
    );
    expect(saveOfferSchema.safeParse({ ...valid, startDate: "1899-01-01" }).success).toBe(
      false,
    );
    expect(saveOfferSchema.safeParse({ ...valid, decision: "MAYBE" }).success).toBe(false);
    expect(
      saveOfferSchema.safeParse({ ...valid, bonus: "x".repeat(121) }).success,
    ).toBe(false);
  });
});
