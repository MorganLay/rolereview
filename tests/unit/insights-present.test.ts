import { describe, expect, it } from "vitest";

import type { InsightsMetrics } from "@/features/insights/metrics";
import { formatWeekLabel, presentInsights } from "@/features/insights/present";

const AS_OF = new Date("2026-10-22T15:00:00.000Z");

function metrics(partial: Partial<InsightsMetrics> = {}): InsightsMetrics {
  return {
    applied: 0,
    response: { count: 0, of: 0, rate: null },
    interview: { count: 0, of: 0, rate: null },
    offer: { count: 0, of: 0, rate: null },
    medianDaysToResponse: null,
    bySource: [],
    byMatchBand: [],
    tailored: [],
    weeks: [],
    funnel: [
      { key: "SAVED", count: 0, fromPrevious: null },
      { key: "APPLIED", count: 0, fromPrevious: null },
      { key: "RESPONDED", count: 0, fromPrevious: null },
      { key: "INTERVIEWED", count: 0, fromPrevious: null },
      { key: "OFFER", count: 0, fromPrevious: null },
    ],
    ...partial,
  };
}

function present(partial: Partial<InsightsMetrics> = {}) {
  return presentInsights({ ...metrics(partial), asOf: AS_OF, timeZone: "America/Toronto" });
}

describe("insights presentation", () => {
  it("uses an em dash when a rate or the median has no jobs", () => {
    const view = present();
    expect(view.kpis.map((tile) => [tile.label, tile.value, tile.detail])).toEqual([
      ["Applied", "0", null],
      ["Response rate", "—", null],
      ["Interview rate", "—", null],
      ["Offers", "—", null],
      ["Median days to response", "—", null],
    ]);
  });

  it("rounds rates, keeps a zero offer count, and formats the median", () => {
    const view = present({
      applied: 6,
      response: { count: 5, of: 6, rate: 5 / 6 },
      interview: { count: 1, of: 6, rate: 1 / 6 },
      offer: { count: 0, of: 6, rate: 0 },
      medianDaysToResponse: 7.26,
      funnel: [
        { key: "SAVED", count: 8, fromPrevious: null },
        { key: "APPLIED", count: 7, fromPrevious: 7 / 8 },
        { key: "RESPONDED", count: 0, fromPrevious: 0 },
        { key: "INTERVIEWED", count: 0, fromPrevious: null },
        { key: "OFFER", count: 0, fromPrevious: null },
      ],
    });

    expect(view.kpis[1]).toMatchObject({ value: "83%", detail: "5 of 6" });
    expect(view.kpis[2]).toMatchObject({ value: "17%", detail: "1 of 6" });
    expect(view.kpis[3]?.value).toBe("0");
    expect(view.kpis[4]?.value).toBe("7.3 days");
    expect(view.funnel[1]?.conversion).toBe("88% of Saved");
    expect(view.funnel[2]?.conversion).toBe("0% of Applied");
    expect(view.funnel[3]?.conversion).toBeNull();
  });

  it("says 1 day for a one-day median and a whole number without a decimal", () => {
    expect(present({ applied: 1, medianDaysToResponse: 1 }).kpis[4]?.value).toBe("1 day");
    expect(present({ applied: 2, medianDaysToResponse: 8 }).kpis[4]?.value).toBe("8 days");
  });

  it("labels weeks, sources, bands, and the sample size", () => {
    expect(formatWeekLabel("2026-10-19", "2026-10-22")).toBe("Oct 19");
    expect(formatWeekLabel("2025-12-29", "2026-10-22")).toBe("Dec 29, 2025");
    expect(formatWeekLabel("not-a-date", "2026-10-22")).toBe("not-a-date");

    const view = present({
      weeks: [{ weekStart: "2026-10-19", tailored: 1, notTailored: 2 }],
      bySource: [
        {
          key: "LINKEDIN",
          applications: 7,
          response: { count: 0, of: 7, rate: 0 },
          interview: { count: 2, of: 7, rate: 2 / 7 },
          offer: { count: 0, of: 7, rate: 0 },
          medianDaysToResponse: null,
        },
        {
          key: "NONE",
          applications: 5,
          response: { count: 0, of: 5, rate: 0 },
          interview: { count: 0, of: 5, rate: 0 },
          offer: { count: 0, of: 5, rate: 0 },
          medianDaysToResponse: null,
        },
      ],
      byMatchBand: [
        {
          key: "FROM_75",
          applications: 5,
          response: { count: 0, of: 5, rate: 0 },
          interview: { count: 5, of: 5, rate: 1 },
          offer: { count: 0, of: 5, rate: 0 },
          medianDaysToResponse: null,
        },
      ],
      tailored: [
        {
          key: "NOT_TAILORED",
          applications: 6,
          response: { count: 0, of: 6, rate: 0 },
          interview: { count: 2, of: 6, rate: 1 / 3 },
          offer: { count: 0, of: 6, rate: 0 },
          medianDaysToResponse: null,
        },
      ],
    });

    expect(view.weeks[0]).toMatchObject({ label: "Oct 19", tailored: 1, notTailored: 2 });
    expect(view.working.source.map((row) => [row.label, row.rate, row.sample])).toEqual([
      ["LinkedIn", "29%", "based on 7 applications"],
      ["Not set", "0%", "based on 5 applications"],
    ]);
    expect(view.working.band[0]).toMatchObject({ label: "75 or higher", rate: "100%" });
    expect(view.working.tailored[0]).toMatchObject({
      label: "Not tailored",
      rate: "33%",
      sample: "based on 6 applications",
    });
  });
});
