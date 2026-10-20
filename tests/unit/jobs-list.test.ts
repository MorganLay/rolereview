import { describe, expect, it } from "vitest";

import {
  calendarDateInTimeZone,
  deadlineUrgency,
} from "@/features/jobs/dates";
import { presentJobListRow } from "@/features/jobs/format";
import {
  compareJobListRows,
  jobListHref,
  parseJobListQuery,
  sortJobList,
  toggledSort,
  type JobListRecord,
} from "@/features/jobs/list-params";
import { ARCHIVE_JOBS_MAX, archiveJobsSchema } from "@/features/jobs/schemas";

const JOB_ID = "00000000-0000-4000-8000-000000000001";

function row(partial: Partial<JobListRecord> & Pick<JobListRecord, "id">): JobListRecord {
  return {
    company: "Acme",
    title: "Analyst",
    status: "SAVED",
    priority: null,
    matchScore: null,
    appliedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    deadline: null,
    archived: false,
    ...partial,
  };
}

describe("parseJobListQuery", () => {
  it("defaults to the list, newest activity first", () => {
    expect(parseJobListQuery({})).toEqual({
      view: "list",
      q: "",
      source: null,
      workMode: null,
      minPriority: null,
      hasDeadline: false,
      showArchived: false,
      sort: "activity",
      dir: "desc",
    });
    expect(jobListHref(parseJobListQuery({}))).toBe("/jobs");
  });

  it("keeps known filters and drops junk", () => {
    expect(
      parseJobListQuery({
        view: "board",
        q: ["  nurse  ", "ignored"],
        source: "GC_JOBS",
        workMode: "NOPE",
        priority: "4",
        deadline: "1",
        archived: "1",
        sort: "deadline",
        dir: "desc",
      }),
    ).toMatchObject({
      view: "board",
      q: "nurse",
      source: "GC_JOBS",
      workMode: null,
      minPriority: 4,
      hasDeadline: true,
      showArchived: true,
      sort: "deadline",
      dir: "desc",
    });
    expect(parseJobListQuery({ source: "linkedin", priority: "0", priorityExtra: "9" }).minPriority).toBeNull();
    expect(parseJobListQuery({ priority: "6" }).minPriority).toBeNull();
    expect(parseJobListQuery({ view: "LIST", sort: "nope", dir: "asc" })).toMatchObject({
      view: "list",
      sort: "activity",
      dir: "desc",
    });
  });

  it("trims search text and keeps a SQL-shaped phrase as text", () => {
    const nasty = `  '; DROP TABLE "Job";--  `;
    const parsed = parseJobListQuery({ q: nasty });
    expect(parsed.q).toBe(`'; DROP TABLE "Job";--`);
    expect(parseJobListQuery({ q: "x".repeat(200) }).q).toHaveLength(120);
  });

  it("round-trips a filtered URL", () => {
    const query = parseJobListQuery({
      view: "board",
      q: "  library tech ",
      source: "JOB_BANK",
      workMode: "HYBRID",
      priority: "2",
      deadline: "1",
      archived: "1",
      sort: "company",
      dir: "asc",
    });
    const href = jobListHref(query);
    const params = Object.fromEntries(new URL(href, "http://localhost").searchParams);
    expect(parseJobListQuery(params)).toEqual({ ...query, q: "library tech" });
  });
});

describe("sortJobList", () => {
  const rows = [
    row({
      id: "b",
      company: "beta",
      title: "10 roles",
      status: "OFFER",
      priority: 1,
      matchScore: null,
      appliedAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
      deadline: "2026-04-01",
    }),
    row({
      id: "a",
      company: "Alpha",
      title: "2 roles",
      status: "SAVED",
      priority: 5,
      matchScore: 80,
      appliedAt: null,
      updatedAt: "2026-05-01T00:00:00.000Z",
      deadline: null,
    }),
    row({
      id: "c",
      company: "alpha",
      title: "Analyst",
      status: "REJECTED",
      priority: null,
      matchScore: 40,
      appliedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-15T00:00:00.000Z",
      deadline: "2026-01-02",
    }),
  ];

  it("sorts company A–Z with a numeric title and stable ids", () => {
    expect(sortJobList(rows, "company", "asc").map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(sortJobList(rows, "title", "asc").map((item) => item.title)).toEqual([
      "2 roles",
      "10 roles",
      "Analyst",
    ]);
    expect(toggledSort({ sort: "activity", dir: "desc" }, "company")).toEqual({
      sort: "company",
      dir: "asc",
    });
    expect(toggledSort({ sort: "company", dir: "asc" }, "company")).toEqual({
      sort: "company",
      dir: "desc",
    });
  });

  it("orders status from Saved through the closed stages", () => {
    expect(sortJobList(rows, "status", "asc").map((item) => item.status)).toEqual([
      "SAVED",
      "OFFER",
      "REJECTED",
    ]);
  });

  it("keeps missing priority, match, applied, and deadline at the bottom", () => {
    expect(sortJobList(rows, "priority", "desc").map((item) => item.priority)).toEqual([
      5,
      1,
      null,
    ]);
    expect(sortJobList(rows, "priority", "asc").map((item) => item.priority)).toEqual([
      1,
      5,
      null,
    ]);
    expect(sortJobList(rows, "match", "desc").map((item) => item.matchScore)).toEqual([
      80,
      40,
      null,
    ]);
    expect(sortJobList(rows, "applied", "desc").map((item) => item.id)).toEqual(["b", "c", "a"]);
    expect(sortJobList(rows, "deadline", "asc").map((item) => item.deadline)).toEqual([
      "2026-01-02",
      "2026-04-01",
      null,
    ]);
    expect(sortJobList(rows, "activity", "desc").map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties by id", () => {
    const tied = [
      row({ id: "z", company: "Same", updatedAt: "2026-01-01T00:00:00.000Z" }),
      row({ id: "m", company: "Same", updatedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(compareJobListRows(tied[0]!, tied[1]!, "company", "asc")).toBeGreaterThan(0);
    expect(sortJobList(tied, "activity", "desc").map((item) => item.id)).toEqual(["m", "z"]);
  });
});

describe("deadline urgency", () => {
  it("marks today through three days as soon, and earlier dates as past", () => {
    expect(deadlineUrgency("2026-12-30", "2026-12-30")).toBe("soon");
    expect(deadlineUrgency("2027-01-02", "2026-12-30")).toBe("soon");
    expect(deadlineUrgency("2027-01-03", "2026-12-30")).toBe("later");
    expect(deadlineUrgency("2026-12-29", "2026-12-30")).toBe("past");
    expect(deadlineUrgency("2026-02-31", "2026-02-01")).toBeNull();
    expect(deadlineUrgency("", "2026-02-01")).toBeNull();
  });

  it("uses the timezone's calendar date", () => {
    const evening = new Date("2026-01-15T04:30:00.000Z");
    expect(calendarDateInTimeZone(evening, "America/Toronto")).toBe("2026-01-14");
    expect(calendarDateInTimeZone(evening, "UTC")).toBe("2026-01-15");
    expect(calendarDateInTimeZone(evening, "Not/AZone")).toBe("2026-01-15");
  });
});

describe("presentJobListRow", () => {
  it("labels a soon deadline and leaves a missing match blank", () => {
    const display = presentJobListRow(
      row({
        id: "a",
        deadline: "2026-03-03",
        matchScore: null,
        appliedAt: null,
        updatedAt: "2026-03-01T15:00:00.000Z",
      }),
      "America/Toronto",
      "2026-03-01",
    );
    expect(display.deadlineNote).toBe("soon");
    expect(display.deadlineLabel).toBe("Mar 3, 2026");
    expect(display.matchLabel).toBe("—");
    expect(display.appliedLabel).toBe("—");
    expect(display.activityLabel).toContain("2026");
  });
});

describe("archiveJobsSchema", () => {
  it("requires one to ARCHIVE_JOBS_MAX owned ids", () => {
    expect(archiveJobsSchema.safeParse({ jobIds: [JOB_ID], archived: true }).success).toBe(true);
    expect(archiveJobsSchema.safeParse({ jobIds: [], archived: true }).success).toBe(false);
    expect(
      archiveJobsSchema.safeParse({
        jobIds: Array.from({ length: ARCHIVE_JOBS_MAX + 1 }, () => JOB_ID),
        archived: false,
      }).success,
    ).toBe(false);
    expect(archiveJobsSchema.safeParse({ jobIds: ["nope"], archived: true }).success).toBe(false);
  });
});
