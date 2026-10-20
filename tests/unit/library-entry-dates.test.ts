import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import {
  composeResumeDate,
  formatResumeDate,
  formatResumeDateRange,
  getResumeYearOptions,
  parseResumeDate,
  RESUME_YEAR_MIN,
  resumeDatesInOrder,
} from "@/features/library/dates";
import { moveWithinSection } from "@/features/library/order";
import {
  createEntrySchema,
  ENTRY_LIMITS,
  updateEntrySchema,
  zodFieldErrors,
} from "@/features/library/schemas";

const errors = strings.library.entries.errors;

const validEntry = {
  kind: "EXPERIENCE" as const,
  title: "  Program officer  ",
  organization: " Canada Revenue Agency ",
  location: "",
  url: "",
  startDate: "2023-11",
  endDate: "2019-01",
  isCurrent: true,
};

describe("parseResumeDate", () => {
  it("accepts a year, a year and month, and rejects anything else", () => {
    expect(parseResumeDate("2019")).toEqual({ year: 2019, month: null });
    expect(parseResumeDate("2023-11")).toEqual({ year: 2023, month: 11 });
    expect(parseResumeDate("1900")).toEqual({ year: 1900, month: null });
    expect(parseResumeDate("2099-12")).toEqual({ year: 2099, month: 12 });

    for (const value of [
      "",
      "2019-13",
      "2019-00",
      "2019-1",
      "19",
      "2019-11-01",
      "1899",
      "2100",
      "Nov 2023",
    ]) {
      expect(parseResumeDate(value), value).toBeNull();
    }
  });
});

describe("getResumeYearOptions", () => {
  it("starts five years ahead and ends at 1900", () => {
    const years = getResumeYearOptions();
    expect(years[0]).toBe(String(new Date().getUTCFullYear() + 5));
    expect(years.at(-1)).toBe(String(RESUME_YEAR_MIN));
  });
});

describe("resumeDatesInOrder", () => {
  it("allows a missing date, a later end, and a year-only date in the same year", () => {
    expect(resumeDatesInOrder(null, "2020")).toBe(true);
    expect(resumeDatesInOrder("2019-11", null)).toBe(true);
    expect(resumeDatesInOrder("2019-11", "2020-01")).toBe(true);
    expect(resumeDatesInOrder("2019-06", "2019-06")).toBe(true);
    expect(resumeDatesInOrder("2019", "2019-06")).toBe(true);
    expect(resumeDatesInOrder("2019-06", "2019")).toBe(true);
  });

  it("rejects an end that is before the start when both months are known", () => {
    expect(resumeDatesInOrder("2020-01", "2019-11")).toBe(false);
    expect(resumeDatesInOrder("2019-07", "2019-06")).toBe(false);
    expect(resumeDatesInOrder("2019-06", "2018")).toBe(false);
  });
});

describe("formatResumeDate", () => {
  it("writes a month name, a bare year, or a present range", () => {
    expect(formatResumeDate("2023-11")).toBe("Nov 2023");
    expect(formatResumeDate("2019")).toBe("2019");
    expect(formatResumeDate(null)).toBeNull();
    expect(formatResumeDate("nope")).toBeNull();
    expect(formatResumeDateRange("2023-11", "2024-01", false, "Present")).toBe(
      "Nov 2023 – Jan 2024",
    );
    expect(formatResumeDateRange("2023-11", "2020-01", true, "Present")).toBe(
      "Nov 2023 – Present",
    );
    expect(formatResumeDateRange("2019", null, false, "Present")).toBe("2019");
    expect(formatResumeDateRange(null, null, false, "Present")).toBeNull();
  });
});

describe("createEntrySchema", () => {
  it("trims text, drops blanks, and clears the end date when current", () => {
    const parsed = createEntrySchema.parse(validEntry);
    expect(parsed).toEqual({
      kind: "EXPERIENCE",
      title: "Program officer",
      organization: "Canada Revenue Agency",
      location: null,
      url: null,
      startDate: "2023-11",
      endDate: null,
      isCurrent: true,
    });
  });

  it("keeps a year-only range and rejects an end before the start", () => {
    const yearOnly = createEntrySchema.safeParse({
      ...validEntry,
      startDate: "2019-06",
      endDate: "2019",
      isCurrent: false,
    });
    expect(yearOnly.success).toBe(true);

    const reversed = createEntrySchema.safeParse({
      ...validEntry,
      startDate: "2020-01",
      endDate: "2019-11",
      isCurrent: false,
    });
    expect(reversed.success).toBe(false);
    if (!reversed.success) {
      expect(zodFieldErrors(reversed.error).endDate).toEqual([errors.dateOrder]);
    }
  });

  it("rejects a blank title, a month without a year, and a non-http url", () => {
    const blank = createEntrySchema.safeParse({ ...validEntry, title: "   " });
    expect(blank.success).toBe(false);
    if (!blank.success) {
      expect(zodFieldErrors(blank.error).title).toEqual([errors.title]);
    }

    const monthOnly = createEntrySchema.safeParse({
      ...validEntry,
      startDate: composeResumeDate("", "06"),
      isCurrent: false,
      endDate: "",
    });
    expect(monthOnly.success).toBe(false);
    if (!monthOnly.success) {
      expect(zodFieldErrors(monthOnly.error).startDate).toEqual([errors.date]);
    }

    const badUrl = createEntrySchema.safeParse({
      ...validEntry,
      url: "javascript:alert(1)",
    });
    expect(badUrl.success).toBe(false);
    if (!badUrl.success) {
      expect(zodFieldErrors(badUrl.error).url).toEqual([errors.url]);
    }

    expect(
      createEntrySchema.safeParse({
        ...validEntry,
        url: "https://example.com/role",
      }).success,
    ).toBe(true);
  });

  it("accepts the title cap and rejects one character over", () => {
    const atCap = createEntrySchema.safeParse({
      ...validEntry,
      title: "a".repeat(ENTRY_LIMITS.title),
    });
    expect(atCap.success).toBe(true);

    const over = createEntrySchema.safeParse({
      ...validEntry,
      title: "a".repeat(ENTRY_LIMITS.title + 1),
    });
    expect(over.success).toBe(false);
    if (!over.success) {
      expect(zodFieldErrors(over.error).title).toEqual([errors.titleLength]);
    }
  });
});

describe("updateEntrySchema", () => {
  it("requires an id and does not take a kind", () => {
    const parsed = updateEntrySchema.parse({
      id: "6f1b3c2a-7d4e-4f8a-9b1c-2d3e4f5a6b7c",
      title: "Analyst",
      organization: "",
      location: "Ottawa",
      url: "http://example.com",
      startDate: "2019",
      endDate: "",
      isCurrent: false,
    });
    expect(parsed).toMatchObject({
      title: "Analyst",
      organization: null,
      location: "Ottawa",
      url: "http://example.com",
      startDate: "2019",
      endDate: null,
      isCurrent: false,
    });
  });
});

describe("moveWithinSection", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("swaps with the neighbour and rewrites sort order from zero", () => {
    expect(moveWithinSection(rows, "b", "up")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
    expect(moveWithinSection(rows, "b", "down")).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "c", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
  });

  it("returns null at the ends and for an unknown id", () => {
    expect(moveWithinSection(rows, "a", "up")).toBeNull();
    expect(moveWithinSection(rows, "c", "down")).toBeNull();
    expect(moveWithinSection(rows, "missing", "down")).toBeNull();
    expect(moveWithinSection([], "a", "down")).toBeNull();
  });
});
