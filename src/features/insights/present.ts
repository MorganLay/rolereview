/**
 * Display values for the Insights page. Rates and the funnel stay in metrics.ts.
 */

import { strings } from "@/copy/strings";
import { calendarDateInTimeZone } from "@/features/jobs/dates";
import { JOB_SOURCES, type JobSourceValue } from "@/features/jobs/schemas";

import {
  MATCH_BANDS,
  SOURCE_NONE,
  type FunnelStage,
  type InsightsBreakdown,
  type InsightsMetrics,
  type InsightsRate,
  type MatchBand,
} from "./metrics";

type Presentable = InsightsMetrics & {
  asOf: Date;
  timeZone: string;
};

const copy = strings.insights;
const sources: ReadonlySet<string> = new Set(JOB_SOURCES);
const bands: ReadonlySet<string> = new Set(MATCH_BANDS);

export type KpiTile = {
  label: string;
  value: string;
  detail: string | null;
};

export type FunnelRow = {
  key: FunnelStage;
  label: string;
  count: number;
  conversion: string | null;
};

export type WeekRow = {
  weekStart: string;
  label: string;
  tailored: number;
  notTailored: number;
};

export type WorkingRow = {
  key: string;
  label: string;
  rate: string;
  sample: string;
  percent: number;
};

export type InsightsPresentation = {
  kpis: KpiTile[];
  funnel: FunnelRow[];
  weeks: WeekRow[];
  working: {
    source: WorkingRow[];
    band: WorkingRow[];
    tailored: WorkingRow[];
  };
};

export function presentInsights(data: Presentable): InsightsPresentation {
  const today = calendarDateInTimeZone(data.asOf, data.timeZone);
  const weeks = data.weeks.map((week) => ({
    weekStart: week.weekStart,
    label: formatWeekLabel(week.weekStart, today),
    tailored: week.tailored,
    notTailored: week.notTailored,
  }));

  return {
    kpis: [
      { label: copy.applied, value: String(data.applied), detail: null },
      responseTile(data.responded, data.response),
      rateTile(copy.interviewRate, data.interview),
      {
        label: copy.offers,
        value: data.applied === 0 ? copy.emptyValue : String(data.offer.count),
        detail: null,
      },
      { label: copy.medianDays, value: medianValue(data.medianDaysToResponse), detail: null },
    ],
    funnel: data.funnel.map((stage, index) => {
      const previous = data.funnel[index - 1];
      return {
        key: stage.key,
        label: copy.stages[stage.key],
        count: stage.count,
        conversion:
          stage.fromPrevious === null || !previous
            ? null
            : copy.ofStage(
                copy.percent(Math.round(stage.fromPrevious * 100)),
                copy.stages[previous.key],
              ),
      };
    }),
    weeks,
    working: {
      source: workingRows(data.bySource, sourceLabel),
      band: workingRows(data.byMatchBand, bandLabel),
      tailored: workingRows(data.tailored, tailoredLabel),
    },
  };
}

/** Monday label. A week in another year includes the year. Invalid input is returned as-is. */
export function formatWeekLabel(iso: string, today: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return iso;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(today.startsWith(`${year}-`) ? {} : { year: "numeric" }),
  }).format(date);
}

/** The percent uses the 7-day window. The count is the funnel’s Responded number. */
function responseTile(responded: number, rate: InsightsRate): KpiTile {
  if (rate.rate === null && responded === 0) {
    return { label: copy.responseRate, value: copy.emptyValue, detail: null };
  }
  return {
    label: copy.responseRate,
    value: rate.rate === null ? copy.emptyValue : copy.percent(Math.round(rate.rate * 100)),
    detail: copy.respondedCount(responded),
  };
}

function rateTile(label: string, rate: InsightsRate): KpiTile {
  if (rate.rate === null) return { label, value: copy.emptyValue, detail: null };
  return {
    label,
    value: copy.percent(Math.round(rate.rate * 100)),
    detail: copy.ofCount(rate.count, rate.of),
  };
}

function medianValue(days: number | null): string {
  if (days === null) return copy.emptyValue;
  const rounded = Math.round(days * 10) / 10;
  if (rounded === 1) return copy.oneDay;
  const shown = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return copy.days(shown);
}

function workingRows(
  groups: readonly InsightsBreakdown[],
  labelOf: (key: string) => string,
): WorkingRow[] {
  return groups.map((group) => {
    const percent =
      group.interview.rate === null ? 0 : Math.round(group.interview.rate * 100);
    return {
      key: group.key,
      label: labelOf(group.key),
      rate: copy.percent(percent),
      sample: copy.sample(group.applications),
      percent,
    };
  });
}

function sourceLabel(key: string): string {
  if (key === SOURCE_NONE || !sources.has(key)) return strings.jobs.sourceNone;
  return strings.jobs.sources[key as JobSourceValue];
}

function bandLabel(key: string): string {
  if (!bands.has(key)) return key;
  return copy.bands[key as MatchBand];
}

function tailoredLabel(key: string): string {
  return key === "TAILORED" ? copy.tailored : copy.notTailored;
}
