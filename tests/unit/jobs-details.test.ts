import { describe, expect, it } from "vitest";

import {
  deadlineInstant,
  formatDeadlineDate,
  planDeadlineReminder,
} from "@/features/jobs/dates";
import {
  isClosedJobStatus,
  isJobStatus,
  updateJobDetailsSchema,
  updateJobIdentitySchema,
} from "@/features/jobs/schemas";

const JOB_ID = "00000000-0000-4000-8000-000000000001";

function details(partial: Record<string, string> = {}) {
  return updateJobDetailsSchema.safeParse({
    jobId: JOB_ID,
    source: "NONE",
    sourceDetail: "",
    workMode: "UNKNOWN",
    employmentType: "NONE",
    salaryMin: "",
    salaryMax: "",
    salaryCurrency: "",
    salaryPeriod: "NONE",
    referenceNumber: "",
    deadline: "",
    notes: "",
    ...partial,
  });
}

describe("planDeadlineReminder", () => {
  it("leaves the reminder when the deadline is unchanged", () => {
    const day = deadlineInstant("2026-03-01");
    expect(planDeadlineReminder(null, null)).toEqual({ action: "keep" });
    expect(planDeadlineReminder(day, deadlineInstant("2026-03-01"))).toEqual({
      action: "keep",
    });
  });

  it("moves or creates the reminder three days before a new date", () => {
    const next = deadlineInstant("2026-03-01");
    expect(planDeadlineReminder(null, next)).toEqual({
      action: "upsert",
      dueAt: deadlineInstant("2026-02-26"),
    });
    expect(planDeadlineReminder(deadlineInstant("2026-04-01"), next)).toEqual({
      action: "upsert",
      dueAt: deadlineInstant("2026-02-26"),
    });
    expect(planDeadlineReminder(null, deadlineInstant("2024-03-01"))).toEqual({
      action: "upsert",
      dueAt: deadlineInstant("2024-02-27"),
    });
    expect(planDeadlineReminder(null, deadlineInstant("2026-01-02"))).toEqual({
      action: "upsert",
      dueAt: deadlineInstant("2025-12-30"),
    });
  });

  it("dismisses the open reminder when the deadline is cleared", () => {
    expect(planDeadlineReminder(deadlineInstant("2026-03-01"), null)).toEqual({
      action: "dismiss",
    });
  });
});

describe("formatDeadlineDate", () => {
  it("prints the UTC calendar date", () => {
    expect(formatDeadlineDate(deadlineInstant("2026-03-01"))).toBe("2026-03-01");
  });
});

describe("updateJobDetailsSchema", () => {
  it("stores blanks as null and uppercases currency", () => {
    const parsed = details({
      sourceDetail: "  ",
      notes: "  ",
      salaryCurrency: "cad",
      salaryMin: "80000",
      salaryMax: "100000",
      salaryPeriod: "YEAR",
      deadline: "2026-10-20",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.sourceDetail).toBeNull();
    expect(parsed.data.notes).toBeNull();
    expect(parsed.data.salaryCurrency).toBe("CAD");
    expect(parsed.data.salaryMin).toBe(80_000);
    expect(parsed.data.deadline).toBe("2026-10-20");
  });

  it("rejects a minimum above the maximum", () => {
    const parsed = details({ salaryMin: "100", salaryMax: "90" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path[0] === "salaryMax")).toBe(
      true,
    );
  });

  it("rejects a currency that is not three letters", () => {
    expect(details({ salaryCurrency: "CA" }).success).toBe(false);
    expect(details({ salaryCurrency: "CADD" }).success).toBe(false);
  });
});

describe("updateJobIdentitySchema", () => {
  it("requires a title and company", () => {
    const parsed = updateJobIdentitySchema.safeParse({
      jobId: JOB_ID,
      title: "  ",
      company: "",
      location: "",
      url: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps an https link and clears a blank location", () => {
    const parsed = updateJobIdentitySchema.safeParse({
      jobId: JOB_ID,
      title: "Analyst",
      company: "Acme",
      location: "  ",
      url: "https://example.com/jobs/1",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.location).toBeNull();
    expect(parsed.data.url).toBe("https://example.com/jobs/1");
  });
});

describe("job status helpers", () => {
  it("treats the four closed stages as closed", () => {
    expect(isClosedJobStatus("REJECTED")).toBe(true);
    expect(isClosedJobStatus("APPLIED")).toBe(false);
    expect(isJobStatus("NO_RESPONSE")).toBe(true);
    expect(isJobStatus("HIRED")).toBe(false);
  });
});
