import { describe, expect, it } from "vitest";

import {
  marketingPlanInput,
  type MarketingPlanInput,
} from "@/features/billing/catalog";
import { PLANS } from "@/features/billing/plans";
import { formatPlanUsd } from "@/features/billing/present";
import { DASHBOARD_HREF, SIGN_IN_HREF, primaryCta } from "@/features/marketing/cta";
import {
  billingFaqItems,
  faqItems,
  faqJsonLd,
} from "@/features/marketing/faq";
import {
  presentFoundingOffer,
  presentMarketingPricing,
  presentPricingComparison,
  quarterlySavePercent,
  softwareApplicationJsonLd,
} from "@/features/marketing/present";

const SAMPLE: MarketingPlanInput = {
  freeMonthlyUsd: 0,
  monthlyUsd: 19,
  quarterlyUsd: 45,
  foundingPercent: 40,
  tailor: { free: 3, pro: 80, period: "month" },
  letter: { free: 1, pro: 60, period: "month" },
  resumeImport: { free: 2, pro: 20, period: "month" },
  jobAnalysis: { free: 10, pro: 60, period: "day" },
  modernTemplate: true,
  compactTemplate: true,
  docx: true,
  insightsWhatsWorking: true,
};

describe("quarterlySavePercent", () => {
  const cases: Array<{
    name: string;
    monthly: number;
    quarterly: number;
    percent: number | null;
  }> = [
    { name: "19 monthly vs 45 quarterly is 21%", monthly: 19, quarterly: 45, percent: 21 },
    { name: "same as three months is 0%", monthly: 19, quarterly: 57, percent: 0 },
    { name: "more expensive quarterly is 0%", monthly: 19, quarterly: 80, percent: 0 },
    { name: "zero monthly cannot compare", monthly: 0, quarterly: 45, percent: null },
    { name: "negative monthly cannot compare", monthly: -19, quarterly: 45, percent: null },
    { name: "non-finite monthly cannot compare", monthly: Number.NaN, quarterly: 45, percent: null },
    { name: "negative quarterly cannot compare", monthly: 19, quarterly: -1, percent: null },
  ];

  it.each(cases)("$name", ({ monthly, quarterly, percent }) => {
    expect(quarterlySavePercent(monthly, quarterly)).toBe(percent);
  });
});

describe("presentMarketingPricing", () => {
  it("formats prices, the quarterly save, and five plan differences", () => {
    const view = presentMarketingPricing(SAMPLE);
    expect(view).not.toBeNull();
    expect(view?.free).toBe("US$0");
    expect(view?.monthly).toBe("US$19");
    expect(view?.quarterly).toBe("US$45");
    expect(view?.savePercent).toBe(21);
    expect(view?.freeTailor).toBe(3);
    expect(view?.rows.map((row) => row.id)).toEqual([
      "tailor",
      "letter",
      "templates",
      "docx",
      "insights",
    ]);
    expect(view?.rows[0]).toMatchObject({ free: "3 a month", pro: "80 a month" });
    expect(view?.rows[1]).toMatchObject({ free: "1 a month", pro: "60 a month" });
    expect(view?.rows[2]).toMatchObject({
      free: "Classic",
      pro: "Classic, Modern, Compact",
    });
    expect(view?.rows[3]).toMatchObject({ free: "Not included", pro: "Included" });
    expect(view?.rows[4]?.pro).toContain("What’s working");
  });

  it("omits Pro templates the plan does not include", () => {
    const view = presentMarketingPricing({
      ...SAMPLE,
      modernTemplate: false,
      compactTemplate: false,
      docx: false,
      insightsWhatsWorking: false,
    });
    expect(view?.rows[2]?.pro).toBe("Classic");
    expect(view?.rows[3]?.pro).toBe("Not included");
    expect(view?.rows[4]?.pro).toBe(view?.rows[4]?.free);
  });

  it("returns null when a price cannot be formatted", () => {
    expect(presentMarketingPricing({ ...SAMPLE, monthlyUsd: Number.NaN })).toBeNull();
  });

  it("reads live numbers from plans.ts", () => {
    const view = presentMarketingPricing(marketingPlanInput());
    expect(view?.monthly).toBe(formatPlanUsd(PLANS.PRO.price.monthlyUsd));
    expect(view?.quarterly).toBe(formatPlanUsd(PLANS.PRO.price.quarterlyUsd));
    expect(view?.freeTailor).toBe(PLANS.FREE.limits.TAILOR.allowance);
    expect(view?.rows).toHaveLength(5);
  });
});

describe("primaryCta", () => {
  it("sends signed-out visitors to import and signed-in visitors to the dashboard", () => {
    expect(primaryCta(false)).toEqual({
      href: SIGN_IN_HREF,
      label: "Tailor your first resume — free",
    });
    expect(primaryCta(false, true).label).toBe("Start free");
    expect(primaryCta(true)).toEqual({
      href: DASHBOARD_HREF,
      label: "Go to dashboard",
    });
    expect(primaryCta(true, true).label).toBe("Go to dashboard");
  });
});

describe("faqItems", () => {
  it("fills the Free answer from the tailor allowance and builds FAQPage JSON-LD", () => {
    const items = faqItems(3);
    expect(items).toHaveLength(9);
    expect(items.map((item) => item.id)).toContain("make-up");
    expect(items.find((item) => item.id === "free")?.answer).toContain("3 tailored resumes");
    const json = faqJsonLd(items);
    expect(json["@type"]).toBe("FAQPage");
    expect(json.mainEntity).toHaveLength(9);
  });
});

describe("presentPricingComparison", () => {
  it("builds the 1.0 table from plan meters and entitlements", () => {
    const rows = presentPricingComparison(SAMPLE);
    expect(rows.map((row) => row.id)).toEqual([
      "tailor",
      "letter",
      "import",
      "analyze",
      "tracking",
      "templates",
      "docx",
      "insights",
      "guarantee",
    ]);
    expect(rows.find((row) => row.id === "import")).toMatchObject({
      free: "2 a month",
      pro: "20 a month",
    });
    expect(rows.find((row) => row.id === "analyze")).toMatchObject({
      free: "10 a day",
      pro: "60 a day",
    });
    expect(rows.find((row) => row.id === "guarantee")?.pro).toBe("14-day refund");
  });

  it("reads live numbers from plans.ts", () => {
    const rows = presentPricingComparison(marketingPlanInput());
    expect(rows.find((row) => row.id === "tailor")?.free).toBe(
      `${PLANS.FREE.limits.TAILOR.allowance} a month`,
    );
    expect(rows.find((row) => row.id === "import")?.pro).toBe(
      `${PLANS.PRO.limits.IMPORT.allowance} a month`,
    );
    expect(rows.find((row) => row.id === "analyze")?.free).toBe(
      `${PLANS.FREE.limits.ANALYZE.allowance} a day`,
    );
  });
});

describe("presentFoundingOffer", () => {
  it("formats the founding prices from the percent off Pro", () => {
    const offer = presentFoundingOffer(SAMPLE);
    expect(offer).toEqual({
      percent: 40,
      monthly: "US$11.40",
      quarterly: "US$27",
    });
  });

  it("returns null when the percent cannot be applied", () => {
    expect(presentFoundingOffer({ ...SAMPLE, foundingPercent: -1 })).toBeNull();
  });
});

describe("billingFaqItems", () => {
  it("includes the weekly-plan answer and founding percent", () => {
    const items = billingFaqItems({ freeTailor: 3, foundingPercent: 40 });
    expect(items.map((item) => item.id)).toContain("billing-weekly");
    expect(items.find((item) => item.id === "billing-founding")?.answer).toContain("40%");
    expect(items.find((item) => item.id === "billing-free")?.answer).toContain(
      "3 tailored resumes",
    );
    expect(faqJsonLd(items)["@type"]).toBe("FAQPage");
  });
});

describe("softwareApplicationJsonLd", () => {
  it("lists Free and both Pro intervals from the plan prices", () => {
    const json = softwareApplicationJsonLd({
      name: "RoleRefine",
      description: "Tailor your resume to every job, using only your real experience.",
      url: "https://www.rolerefine.ca/pricing",
      freeUsd: SAMPLE.freeMonthlyUsd,
      monthlyUsd: SAMPLE.monthlyUsd,
      quarterlyUsd: SAMPLE.quarterlyUsd,
    });
    expect(json["@type"]).toBe("SoftwareApplication");
    expect(json.offers).toEqual([
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro monthly", price: "19", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro 90-day", price: "45", priceCurrency: "USD" },
    ]);
  });
});
