/** Resume dates are "YYYY" or "YYYY-MM". Years outside this range are rejected. */
export const RESUME_YEAR_MIN = 1900;
export const RESUME_YEAR_MAX = 2099;

const DATE_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/;

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

export type ResumeDate = {
  year: number;
  month: number | null;
};

/**
 * Recent years first. Validation still allows through 2099; the picker starts
 * five years ahead so a new entry opens near the dates people use.
 * Built on first use so importing this module does not read the current time
 * during a server prerender (the health check imports the parser).
 */
let resumeYearOptions: readonly string[] | null = null;

export function getResumeYearOptions(): readonly string[] {
  if (resumeYearOptions) return resumeYearOptions;
  const pickerEndYear = Math.min(
    RESUME_YEAR_MAX,
    new Date().getUTCFullYear() + 5,
  );
  resumeYearOptions = Array.from(
    { length: pickerEndYear - RESUME_YEAR_MIN + 1 },
    (_, index) => String(pickerEndYear - index),
  );
  return resumeYearOptions;
}

export function parseResumeDate(value: string): ResumeDate | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const yearText = match[1];
  if (yearText === undefined) return null;
  const year = Number(yearText);
  if (year < RESUME_YEAR_MIN || year > RESUME_YEAR_MAX) return null;
  const monthText = match[2];
  return {
    year,
    month: monthText === undefined ? null : Number(monthText),
  };
}

/**
 * True when `end` is on or after `start`. A missing month is not treated as
 * January: `2019` and `2019-06` in the same year are a valid range.
 */
export function resumeDatesInOrder(
  start: string | null,
  end: string | null,
): boolean {
  if (start === null || end === null) return true;
  const startDate = parseResumeDate(start);
  const endDate = parseResumeDate(end);
  if (!startDate || !endDate) return false;
  if (startDate.year !== endDate.year) return endDate.year > startDate.year;
  if (startDate.month === null || endDate.month === null) return true;
  return endDate.month >= startDate.month;
}

export function formatMonth(month: number): string {
  return monthFormatter.format(new Date(Date.UTC(2000, month - 1, 1)));
}

/** "Nov 2023" or "2019". Invalid values render as nothing. */
export function formatResumeDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = parseResumeDate(value);
  if (!parsed) return null;
  if (parsed.month === null) return String(parsed.year);
  return `${formatMonth(parsed.month)} ${parsed.year}`;
}

/** "Nov 2023 – Present", "2019 – 2021", or a single date when the other is blank. */
export function formatResumeDateRange(
  start: string | null,
  end: string | null,
  isCurrent: boolean,
  presentLabel: string,
): string | null {
  const startLabel = formatResumeDate(start);
  const endLabel = isCurrent ? presentLabel : formatResumeDate(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel ?? endLabel;
}

export function splitResumeDate(value: string | null): {
  year: string;
  month: string;
} {
  const parsed = value ? parseResumeDate(value) : null;
  if (!parsed) return { year: "", month: "" };
  return {
    year: String(parsed.year),
    month:
      parsed.month === null ? "" : String(parsed.month).padStart(2, "0"),
  };
}

/** Join picker values. A month without a year stays invalid so the schema can reject it. */
export function composeResumeDate(year: string, month: string): string {
  if (!year) return month;
  if (!month) return year;
  return `${year}-${month}`;
}
