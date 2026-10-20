import { strings } from "@/copy/strings";

const copy = strings.jobs.result;

export function formatSalaryLabel(job: {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: "HOUR" | "YEAR" | null;
}): string | null {
  if (job.salaryMin === null && job.salaryMax === null) return null;
  const amount =
    job.salaryMin !== null &&
    job.salaryMax !== null &&
    job.salaryMin !== job.salaryMax
      ? `${formatAmount(job.salaryMin)}–${formatAmount(job.salaryMax)}`
      : formatAmount(job.salaryMin ?? job.salaryMax ?? 0);
  const period =
    job.salaryPeriod === "HOUR"
      ? copy.salaryPerHour
      : job.salaryPeriod === "YEAR"
        ? copy.salaryPerYear
        : null;
  return [job.salaryCurrency, amount, period].filter(Boolean).join(" ");
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-CA").format(value);
}

/** Short label for a `YYYY-MM-DD` deadline. Invalid input is returned as-is. */
export function formatDeadlineLabel(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
