import { strings } from "@/copy/strings";

import { deadlineUrgency } from "./dates";
import type { JobListRecord } from "./list-params";
import type { LatestReadyResume } from "./next-action";
import { WORK_MODES, type JobStatusValue } from "./schemas";

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

const ARRANGEMENT =
  /^(?:remote|hybrid|on-?site|onsite|in-?office|virtual|wfh|work from home)$/i;
const STREET_SUFFIX =
  /(?:street|avenue|road|drive|boulevard|lane|way|court|crescent|place|terrace|circle|blvd|ave|rd|dr|ln|ct|cres|pl|ter|cir|st)\.?$/i;
const TIMEZONE =
  /^(?:utc|gmt|[ecmpa]t|et|ct|mt|pt|est|edt|cst|cdt|mst|mdt|pst|pdt|ast|adt|nst|ndt|akst|akdt|hst)(?:\s*[+-]\s*\d{1,2}(?::\d{2})?)?$/i;
const SENIORITY =
  /^(?:senior|junior|staff|lead|principal|intern|internship|entry|mid|associate|contract|full-time|part-time|temporary)$/i;

/**
 * City and country, or the two place parts already stored.
 * A street and words like "Virtual" are left off the card.
 */
export function boardLocationSummary(location: string | null): string | null {
  const raw = location?.trim() ?? "";
  if (!raw) return null;
  const kept = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !ARRANGEMENT.test(part) && !isStreetPart(part));
  if (kept.length === 0) return null;
  if (kept.length <= 2) return kept.join(", ");
  return `${kept[0]}, ${kept[kept.length - 1]}`;
}

/** Work mode, then a short place. Unknown mode is left out. */
export function boardPlaceLabel(
  workMode: (typeof WORK_MODES)[number] | null,
  location: string | null,
): string | null {
  const mode =
    workMode === "ONSITE" || workMode === "HYBRID" || workMode === "REMOTE"
      ? copy.workModes[workMode]
      : null;
  const place = boardLocationSummary(location);
  const parts = [mode, place].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The role, without a trailing note that only restates place, work mode, or timezone.
 * A specialty or seniority in parentheses stays.
 */
export function boardCardTitle(title: string): string {
  const match = title.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const base = match?.[1]?.trim() ?? "";
  const note = match?.[2];
  if (!base || note === undefined) return title;
  const tokens = note
    .split(/[,/]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (!tokens.some((token) => ARRANGEMENT.test(token) || TIMEZONE.test(token))) return title;
  const rest = tokens.filter((token) => !ARRANGEMENT.test(token) && !TIMEZONE.test(token));
  const placeOnly = rest.every((token) => isPlaceToken(token) && !SENIORITY.test(token));
  return placeOnly ? base : title;
}

function isPlaceToken(token: string): boolean {
  return /^[\p{L}][\p{L}\s.'-]{0,40}$/u.test(token);
}

/** A numbered line or a part that ends in a street suffix. "St. John's" stays. */
function isStreetPart(part: string): boolean {
  return /\d/.test(part) || STREET_SUFFIX.test(part.trim());
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
  location: string | null;
  workMode: (typeof WORK_MODES)[number];
  status: JobStatusValue;
  priority: number | null;
  matchScore: number | null;
  submitted: boolean;
  deadline: string | null;
  archived: boolean;
  boardOrder: number;
  nextKind: BoardCueKind | null;
  nextAt: string | null;
  analysisReady: boolean;
  latestReadyResume: LatestReadyResume | null;
  hasOffer: boolean;
};

export type BoardCardDisplay = {
  id: string;
  company: string;
  title: string;
  placeLabel: string | null;
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
  analysisReady: boolean;
  latestReadyResume: LatestReadyResume | null;
  hasOffer: boolean;
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
    title: boardCardTitle(card.title),
    placeLabel: boardPlaceLabel(card.workMode, card.location),
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
    analysisReady: card.analysisReady,
    latestReadyResume: card.latestReadyResume,
    hasOffer: card.hasOffer,
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
  analysisReady: boolean;
  latestReadyResume: LatestReadyResume | null;
  hasOffer: boolean;
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
    analysisReady: row.analysisReady,
    latestReadyResume: row.latestReadyResume,
    hasOffer: row.hasOffer,
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
