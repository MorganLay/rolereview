import { strings } from "@/copy/strings";

import { deadlineUrgency } from "./dates";
import type { JobListRecord } from "./list-params";
import type { JobStatusValue } from "./schemas";

const copy = strings.jobs.result;
const board = strings.jobs.board;

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

export type BoardCueKind = "reminder" | "interview";

/** The sooner of an open reminder and an upcoming interview. Equal times keep the reminder. */
export function earlierBoardCue(
  reminderAt: string | null,
  interviewAt: string | null,
): { kind: BoardCueKind; at: string } | null {
  const reminder = instantTime(reminderAt);
  const interview = instantTime(interviewAt);
  if (reminder === null && interview === null) return null;
  if (reminder === null && interviewAt) return { kind: "interview", at: interviewAt };
  if (interview === null && reminderAt) return { kind: "reminder", at: reminderAt };
  if (reminder !== null && interview !== null && reminderAt && interviewAt) {
    return reminder <= interview
      ? { kind: "reminder", at: reminderAt }
      : { kind: "interview", at: interviewAt };
  }
  return null;
}

function instantTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export type BoardCardRecord = {
  id: string;
  company: string;
  title: string;
  status: JobStatusValue;
  priority: number | null;
  matchScore: number | null;
  submitted: boolean;
  deadline: string | null;
  archived: boolean;
  boardOrder: number;
  nextKind: BoardCueKind | null;
  nextAt: string | null;
};

export type BoardCardDisplay = {
  id: string;
  company: string;
  title: string;
  status: JobStatusValue;
  priority: number | null;
  matchLabel: string;
  submitted: boolean;
  deadlineLabel: string | null;
  deadlineNote: "soon" | "past" | null;
  archived: boolean;
  boardOrder: number;
  nextKind: BoardCueKind | null;
  nextLabel: string | null;
};

export function presentBoardCard(
  card: BoardCardRecord,
  timeZone: string,
  today: string,
): BoardCardDisplay {
  const urgency = card.deadline ? deadlineUrgency(card.deadline, today) : null;
  const nextLabel = card.nextAt ? formatJobInstant(card.nextAt, timeZone) : null;
  return {
    id: card.id,
    company: card.company,
    title: card.title,
    status: card.status,
    priority: card.priority,
    matchLabel: card.matchScore === null ? board.emptyValue : String(card.matchScore),
    submitted: card.submitted,
    deadlineLabel: card.deadline ? formatDeadlineLabel(card.deadline) : null,
    deadlineNote: urgency === "soon" || urgency === "past" ? urgency : null,
    archived: card.archived,
    boardOrder: card.boardOrder,
    nextKind: card.nextKind,
    nextLabel: nextLabel === board.emptyValue ? null : nextLabel,
  };
}

export type JobListDisplay = {
  id: string;
  company: string;
  title: string;
  status: JobStatusValue;
  priority: number | null;
  matchLabel: string;
  appliedLabel: string;
  activityLabel: string;
  deadlineLabel: string | null;
  deadlineNote: "soon" | "past" | null;
  archived: boolean;
};

export function presentJobListRow(
  row: JobListRecord,
  timeZone: string,
  today: string,
): JobListDisplay {
  const urgency = row.deadline ? deadlineUrgency(row.deadline, today) : null;
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    status: row.status,
    priority: row.priority,
    matchLabel: row.matchScore === null ? board.emptyValue : String(row.matchScore),
    appliedLabel: formatJobInstant(row.appliedAt, timeZone),
    activityLabel: formatJobInstant(row.updatedAt, timeZone),
    deadlineLabel: row.deadline ? formatDeadlineLabel(row.deadline) : null,
    deadlineNote: urgency === "soon" || urgency === "past" ? urgency : null,
    archived: row.archived,
  };
}

/** A stored instant, shown as a calendar date in the user's timezone. */
export function formatJobInstant(iso: string | null, timeZone: string): string {
  if (!iso) return board.emptyValue;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return board.emptyValue;
  return formatInZone(date, timeZone) ?? formatInZone(date, "UTC") ?? board.emptyValue;
}

function formatInZone(date: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return null;
  }
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
