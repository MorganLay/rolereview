import { describe, expect, it } from "vitest";

import { allowanceCatalog, checkoutPrices } from "@/features/billing/catalog";
import { FOUNDING_DISCOUNT_PERCENT, PLANS } from "@/features/billing/plans";
import {
  checkoutConfirmed,
  discountedPrice,
  formatPlanPrice,
  parseSettingsTab,
  presentCheckoutNotice,
  presentCheckoutPrices,
  presentPlanSummary,
  presentTailorPill,
  presentUpgrade,
  presentUsageRow,
  settingsHref,
  usagePercent,
  type AllowanceCatalog,
  type UsageSnapshot,
} from "@/features/billing/present";

const CATALOG: AllowanceCatalog = {
  TAILOR: { free: 4, pro: 9, period: "month", dailyCapFree: null, dailyCapPro: null },
  COVER_LETTER: { free: 1, pro: 6, period: "month", dailyCapFree: null, dailyCapPro: null },
  IMPORT: { free: 2, pro: 8, period: "month", dailyCapFree: null, dailyCapPro: null },
  ANALYZE: { free: 5, pro: 7, period: "month", dailyCapFree: 2, dailyCapPro: 4 },
};

function row(partial: Partial<UsageSnapshot> & Pick<UsageSnapshot, "meter">): UsageSnapshot {
  return {
    used: 0,
    allowance: 3,
    bonus: 0,
    period: "month",
    dailyCap: null,
    ...partial,
  };
}

describe("usagePercent", () => {
  const cases: Array<{ name: string; used: number; allowance: number; percent: number }> = [
    { name: "none used", used: 0, allowance: 3, percent: 0 },
    { name: "rounds two thirds up", used: 2, allowance: 3, percent: 67 },
    { name: "one third rounds down", used: 1, allowance: 3, percent: 33 },
    { name: "full allowance", used: 3, allowance: 3, percent: 100 },
    { name: "over the allowance stays full", used: 4, allowance: 3, percent: 100 },
    { name: "zero allowance and nothing used", used: 0, allowance: 0, percent: 0 },
    { name: "zero allowance with use", used: 1, allowance: 0, percent: 100 },
    { name: "negative used is empty", used: -2, allowance: 3, percent: 0 },
    { name: "non-finite used is empty", used: Number.NaN, allowance: 3, percent: 0 },
    { name: "non-finite allowance with use is full", used: 1, allowance: Number.NaN, percent: 100 },
  ];

  it.each(cases)("$name", ({ used, allowance, percent }) => {
    expect(usagePercent(used, allowance)).toBe(percent);
  });
});

describe("presentUsageRow", () => {
  it("names the monthly meter, the count, and no bonus line", () => {
    const view = presentUsageRow(row({ meter: "TAILOR", used: 2, allowance: 3, bonus: 0 }));
    expect(view.label).toBe("Tailored resumes");
    expect(view.period).toBe("This month");
    expect(view.note).toBeNull();
    expect(view.count).toBe("2 of 3");
    expect(view.bonus).toBeNull();
    expect(view.percent).toBe(67);
    expect(view.aria).toBe("Tailored resumes, This month: 2 of 3.");
  });

  it("uses today for job analyses and lists one extra credit", () => {
    const view = presentUsageRow(
      row({ meter: "ANALYZE", used: 10, allowance: 10, bonus: 1, period: "day" }),
    );
    expect(view.period).toBe("Today");
    expect(view.note).toBe("Today");
    expect(view.bonus).toBe("1 extra");
    expect(view.percent).toBe(100);
    expect(view.aria).toBe("Job analyses, Today: 10 of 10. 1 extra.");
  });

  it("shows the monthly allowance and the daily abuse cap together", () => {
    const view = presentUsageRow(
      row({ meter: "ANALYZE", used: 3, allowance: 30, period: "month", dailyCap: 10 }),
    );
    expect(view.period).toBe("This month, up to 10 a day");
    expect(view.note).toBe("Up to 10 a day");
    expect(view.count).toBe("3 of 30");
  });

  it("lists several extra credits and caps the bar when used is over the allowance", () => {
    const view = presentUsageRow(row({ meter: "IMPORT", used: 5, allowance: 2, bonus: 3 }));
    expect(view.count).toBe("5 of 2");
    expect(view.bonus).toBe("3 extra");
    expect(view.percent).toBe(100);
  });
});

describe("presentTailorPill", () => {
  it("shows used of the plan allowance", () => {
    const view = presentTailorPill({ used: 2, allowance: 3, bonus: 0, period: "month" });
    expect(view.label).toBe("2 / 3 tailored resumes");
    expect(view.extra).toBeNull();
    expect(view.aria).toBe("Usage: 2 of 3 tailored resumes this month.");
  });

  it("adds extra credits without folding them into the allowance", () => {
    const view = presentTailorPill({ used: 3, allowance: 3, bonus: 2, period: "month" });
    expect(view.label).toBe("3 / 3 tailored resumes");
    expect(view.extra).toBe("2 extra");
    expect(view.aria).toBe("Usage: 3 of 3 tailored resumes this month. 2 extra.");
  });

  it("follows the meter period", () => {
    const view = presentTailorPill({ used: 1, allowance: 10, bonus: 0, period: "day" });
    expect(view.aria).toBe("Usage: 1 of 10 tailored resumes today.");
  });
});

describe("presentPlanSummary", () => {
  const end = new Date("2026-11-15T17:00:00.000Z");

  it("shows Free with no interval or renewal", () => {
    const view = presentPlanSummary({
      plan: "FREE",
      billingInterval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      foundingMember: false,
      timeZone: "America/Toronto",
    });
    expect(view).toEqual({
      plan: "Free",
      interval: null,
      renewal: null,
      founding: null,
    });
  });

  it("hides leftover interval and renewal after the plan is Free", () => {
    const view = presentPlanSummary({
      plan: "FREE",
      billingInterval: "MONTH",
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      foundingMember: true,
      timeZone: "America/Toronto",
    });
    expect(view.plan).toBe("Free");
    expect(view.interval).toBeNull();
    expect(view.renewal).toBeNull();
    expect(view.founding).toBe("Founding member");
  });

  it("shows a monthly renewal in the user's timezone", () => {
    const view = presentPlanSummary({
      plan: "PRO",
      billingInterval: "MONTH",
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      foundingMember: true,
      timeZone: "America/Toronto",
    });
    expect(view.plan).toBe("Pro");
    expect(view.interval).toBe("Monthly");
    expect(view.renewal).toBe("Renews Nov 15, 2026");
    expect(view.founding).toBe("Founding member");
  });

  it("shows the 90-day plan ending when cancel is set", () => {
    const view = presentPlanSummary({
      plan: "PRO",
      billingInterval: "QUARTER",
      currentPeriodEnd: end,
      cancelAtPeriodEnd: true,
      foundingMember: false,
      timeZone: "America/Toronto",
    });
    expect(view.interval).toBe("90 days");
    expect(view.renewal).toBe("Ends Nov 15, 2026");
  });

  it("falls back to UTC when the timezone is not a real zone", () => {
    const view = presentPlanSummary({
      plan: "PRO",
      billingInterval: "MONTH",
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      foundingMember: false,
      timeZone: "Not/AZone",
    });
    expect(view.renewal).toBe("Renews Nov 15, 2026");
  });

  it("omits the date when the period end is missing", () => {
    const view = presentPlanSummary({
      plan: "PRO",
      billingInterval: "MONTH",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: true,
      foundingMember: false,
      timeZone: "America/Toronto",
    });
    expect(view.interval).toBe("Monthly");
    expect(view.renewal).toBeNull();
  });
});

describe("presentUpgrade", () => {
  it("names each quota with the allowances it was given", () => {
    expect(presentUpgrade({ kind: "quota", meter: "TAILOR" }, CATALOG).description).toContain(
      "Free includes 4 a month. Pro includes 9.",
    );
    expect(presentUpgrade({ kind: "quota", meter: "COVER_LETTER" }, CATALOG).description).toContain(
      "Free includes 1 a month. Pro includes 6.",
    );
    expect(presentUpgrade({ kind: "quota", meter: "IMPORT" }, CATALOG).description).toContain(
      "Free includes 2 a month. Pro includes 8.",
    );
    expect(presentUpgrade({ kind: "quota", meter: "ANALYZE" }, CATALOG).description).toContain(
      "Free includes 5 a month, up to 2 a day. Pro includes 7 a month, up to 4 a day.",
    );
  });

  it("names each Pro lock", () => {
    const templates = presentUpgrade({ kind: "feature", feature: "templates" }, CATALOG);
    const docx = presentUpgrade({ kind: "feature", feature: "docx" }, CATALOG);
    const insights = presentUpgrade(
      { kind: "feature", feature: "insights:whats-working" },
      CATALOG,
    );
    const plan = presentUpgrade({ kind: "plan" }, CATALOG);
    expect(templates.description).toBe("Modern and Compact are part of Pro.");
    expect(docx.description).toBe("DOCX is part of Pro.");
    expect(insights.description).toBe("What’s working is part of Pro.");
    expect(plan.description).toContain("higher monthly limits");
    for (const view of [templates, docx, insights, plan]) {
      expect(view.title).toBe("Upgrade to Pro");
    }
  });
});

describe("settings tab", () => {
  it("defaults unknown values to plan", () => {
    expect(parseSettingsTab(undefined)).toBe("plan");
    expect(parseSettingsTab("nope")).toBe("plan");
    expect(parseSettingsTab(["profile", "data"])).toBe("profile");
    expect(parseSettingsTab("preferences")).toBe("preferences");
    expect(parseSettingsTab("data")).toBe("data");
    expect(settingsHref("plan")).toBe("/settings?tab=plan");
  });
});

describe("allowanceCatalog", () => {
  it("copies the four live allowances from plans", () => {
    const catalog = allowanceCatalog();
    for (const meter of ["TAILOR", "COVER_LETTER", "IMPORT", "ANALYZE"] as const) {
      expect(catalog[meter].free).toBe(PLANS.FREE.limits[meter].allowance);
      expect(catalog[meter].pro).toBe(PLANS.PRO.limits[meter].allowance);
      expect(catalog[meter].period).toBe(PLANS.FREE.limits[meter].period);
    }
  });
});

describe("checkout prices", () => {
  it("formats whole dollars with a market prefix and keeps cents", () => {
    expect(formatPlanPrice(24, "USD")).toBe("US$24");
    expect(formatPlanPrice(29, "CAD")).toBe("CA$29");
    expect(formatPlanPrice(19.67, "USD")).toBe("US$19.67");
    expect(formatPlanPrice(14.4, "USD")).toBe("US$14.40");
    expect(formatPlanPrice(17.4, "CAD")).toBe("CA$17.40");
    expect(formatPlanPrice(Number.NaN, "USD")).toBeNull();
    expect(discountedPrice(24, 40)).toBe(14.4);
    expect(discountedPrice(29, 40)).toBe(17.4);
    expect(discountedPrice(59, 40)).toBe(35.4);
    expect(discountedPrice(75, 40)).toBe(45);
    expect(discountedPrice(-1, 40)).toBeNull();
    expect(discountedPrice(24, 101)).toBeNull();
    expect(discountedPrice(24, Number.NaN)).toBeNull();
  });

  it("builds both intervals from the plan prices", () => {
    const usd = checkoutPrices("USD");
    const cad = checkoutPrices("CAD");
    expect(usd.foundingPercent).toBe(FOUNDING_DISCOUNT_PERCENT);
    expect(usd.currency).toBe("USD");
    expect(cad.currency).toBe("CAD");
    expect(usd.monthly).toBe(formatPlanPrice(PLANS.PRO.price.monthly.USD, "USD"));
    expect(usd.quarterly).toBe(formatPlanPrice(PLANS.PRO.price.quarterly.USD, "USD"));
    expect(cad.monthly).toBe("CA$29");
    expect(cad.quarterly).toBe("CA$75");
    expect(usd.quarterlyEquivalent).toBe("US$19.67");
    expect(cad.quarterlyEquivalent).toBe("CA$25");
    expect(usd).toEqual(
      presentCheckoutPrices({
        currency: "USD",
        monthly: PLANS.PRO.price.monthly.USD,
        quarterly: PLANS.PRO.price.quarterly.USD,
        foundingPercent: FOUNDING_DISCOUNT_PERCENT,
      }),
    );
  });

  it("rejects prices that cannot be discounted", () => {
    expect(
      presentCheckoutPrices({
        currency: "USD",
        monthly: -1,
        quarterly: 59,
        foundingPercent: 40,
      }),
    ).toBeNull();
  });

  it("treats upgraded=1 as the checkout return and ignores anything else", () => {
    expect(checkoutConfirmed("1")).toBe(true);
    expect(checkoutConfirmed(["1", "0"])).toBe(true);
    expect(checkoutConfirmed("true")).toBe(false);
    expect(checkoutConfirmed(undefined)).toBe(false);
  });
});

describe("presentCheckoutNotice", () => {
  it("stays quiet when this visit is not a checkout return", () => {
    expect(presentCheckoutNotice({ returned: false, plan: "PRO" })).toBeNull();
    expect(presentCheckoutNotice({ returned: false, plan: "FREE" })).toBeNull();
  });

  it("waits on Stripe while the plan is still Free", () => {
    expect(presentCheckoutNotice({ returned: true, plan: "FREE" })).toEqual({
      tone: "pending",
      message: "Payment received. Your plan updates when Stripe confirms it.",
    });
  });

  it("says Pro is active once the webhook has set the plan", () => {
    expect(presentCheckoutNotice({ returned: true, plan: "PRO" })).toEqual({
      tone: "active",
      message: "Payment received. Pro is active.",
    });
  });
});
