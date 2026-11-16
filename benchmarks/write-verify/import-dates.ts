/**
 * When import leaves a role's date range in the title and the date fields
 * empty, copy that range into the fields. The title is unchanged.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";

export type ParsedTitleDate = {
  ref: string;
  title: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
};

const RANGE =
  /(?:(\d{1,2})\/)?((?:19|20)\d{2})\s*[–—-]\s*(?:(\d{1,2})\/)?((?:19|20)\d{2}|present|current)/i;

export function parseTitleDates(snapshot: LibrarySnapshot): { snapshot: LibrarySnapshot; parsed: ParsedTitleDate[] } {
  const parsed: ParsedTitleDate[] = [];
  const entries = snapshot.entries.map((entry) => {
    if (entry.kind !== "EXPERIENCE" && entry.kind !== "VOLUNTEER") return entry;
    if (entry.startDate || entry.endDate) return entry;
    const match = entry.title.match(RANGE);
    if (!match) return entry;
    const start = dateOf(match[2] ?? "", match[1]);
    const current = /^present|current$/i.test(match[4] ?? "");
    const end = current ? null : dateOf(match[4] ?? "", match[3]);
    if (!start) return entry;
    parsed.push({ ref: entry.ref, title: entry.title, startDate: start, endDate: end, isCurrent: current });
    return { ...entry, startDate: start, endDate: end, isCurrent: current || entry.isCurrent };
  });
  return { snapshot: { ...snapshot, entries }, parsed };
}

function dateOf(year: string, month: string | undefined): string | null {
  if (!/^(?:19|20)\d{2}$/.test(year)) return null;
  if (!month) return year;
  const value = Number(month);
  if (!Number.isInteger(value) || value < 1 || value > 12) return year;
  return `${year}-${String(value).padStart(2, "0")}`;
}

export type RoleDateChange = ParsedTitleDate & { action: "filled" | "cleared" };

const MONTH = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const YEAR_SPAN = new RegExp(
  `(?:(\\d{1,2})\\/)?((?:19|20)\\d{2})\\s*[–—-]\\s*(?:(\\d{1,2})\\/)?((?:19|20)\\d{2}|present|current)`,
  "gi",
);
const MONTH_SPAN = new RegExp(`(${MONTH})\\s+((?:19|20)\\d{2})\\s*[–—-]\\s*(${MONTH})\\s+((?:19|20)\\d{2})`, "gi");
const MONTH_YEAR = new RegExp(`(${MONTH})\\s*[–—-]\\s*(${MONTH})\\s+((?:19|20)\\d{2})`, "gi");

type RangeHit = { from: number; to: number; startDate: string; endDate: string | null; isCurrent: boolean };

/**
 * A heading with exactly one range for one role fills empty date fields.
 * A heading with several ranges keeps its text and gets no date fields.
 */
export function applyRoleDates(snapshot: LibrarySnapshot): { snapshot: LibrarySnapshot; changes: RoleDateChange[] } {
  const changes: RoleDateChange[] = [];
  const entries = snapshot.entries.map((entry) => {
    if (entry.kind !== "EXPERIENCE" && entry.kind !== "VOLUNTEER") return entry;
    const hits = uniqueRanges(entry.title);
    if (hits.length > 1) {
      if (entry.startDate || entry.endDate || entry.isCurrent) {
        changes.push({
          ref: entry.ref,
          title: entry.title,
          startDate: "",
          endDate: null,
          isCurrent: false,
          action: "cleared",
        });
      }
      return { ...entry, startDate: null, endDate: null, isCurrent: false };
    }
    if (hits.length !== 1 || entry.startDate || entry.endDate) return entry;
    const hit = hits[0];
    if (!hit) return entry;
    changes.push({
      ref: entry.ref,
      title: entry.title,
      startDate: hit.startDate,
      endDate: hit.endDate,
      isCurrent: hit.isCurrent,
      action: "filled",
    });
    return { ...entry, startDate: hit.startDate, endDate: hit.endDate, isCurrent: hit.isCurrent };
  });
  return { snapshot: { ...snapshot, entries }, changes };
}

function uniqueRanges(title: string): RangeHit[] {
  const hits: RangeHit[] = [];
  for (const match of title.matchAll(YEAR_SPAN)) addHit(hits, yearHit(match));
  for (const match of title.matchAll(MONTH_SPAN)) addHit(hits, monthPairHit(match));
  for (const match of title.matchAll(MONTH_YEAR)) addHit(hits, monthYearHit(match));
  return hits;
}

function addHit(hits: RangeHit[], hit: RangeHit | null): void {
  if (!hit) return;
  if (hits.some((item) => hit.from < item.to && hit.to > item.from)) return;
  hits.push(hit);
}

function yearHit(match: RegExpMatchArray): RangeHit | null {
  const start = dateOf(match[2] ?? "", match[1]);
  if (!start || match.index === undefined) return null;
  const endRaw = match[4] ?? "";
  const current = /^(?:present|current)$/i.test(endRaw);
  const end = current ? null : dateOf(endRaw, match[3]);
  if (!current && !end) return null;
  return { from: match.index, to: match.index + match[0].length, startDate: start, endDate: end, isCurrent: current };
}

function monthPairHit(match: RegExpMatchArray): RangeHit | null {
  if (match.index === undefined) return null;
  const start = dateOf(match[2] ?? "", monthNumber(match[1] ?? ""));
  const end = dateOf(match[4] ?? "", monthNumber(match[3] ?? ""));
  if (!start || !end) return null;
  return { from: match.index, to: match.index + match[0].length, startDate: start, endDate: end, isCurrent: false };
}

function monthYearHit(match: RegExpMatchArray): RangeHit | null {
  if (match.index === undefined) return null;
  const year = match[3] ?? "";
  const start = dateOf(year, monthNumber(match[1] ?? ""));
  const end = dateOf(year, monthNumber(match[2] ?? ""));
  if (!start || !end) return null;
  return { from: match.index, to: match.index + match[0].length, startDate: start, endDate: end, isCurrent: false };
}

function monthNumber(name: string): string {
  const key = name.slice(0, 3).toLowerCase();
  const months: Record<string, string> = {
    jan: "1", feb: "2", mar: "3", apr: "4", may: "5", jun: "6",
    jul: "7", aug: "8", sep: "9", oct: "10", nov: "11", dec: "12",
  };
  return months[key] ?? "";
}
