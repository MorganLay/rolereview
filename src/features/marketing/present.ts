import { strings } from "@/copy/strings";
import type { MarketingPlanInput } from "@/features/billing/catalog";
import {
  formatPlanUsd,
  presentCheckoutPrices,
} from "@/features/billing/present";

const copy = strings.marketing.home;
const page = strings.marketing.pricing;

export type PricingInterval = "MONTH" | "QUARTER";

export type PricingRowId =
  | "tailor"
  | "letter"
  | "templates"
  | "docx"
  | "insights";

export type PricingRow = {
  id: PricingRowId;
  label: string;
  free: string;
  pro: string;
};

export type MarketingPricingView = {
  free: string;
  monthly: string;
  quarterly: string;
  savePercent: number | null;
  freeTailor: number;
  rows: PricingRow[];
};

/**
 * Percent cheaper than three monthly payments. Whole percent, or null when
 * the inputs cannot be compared.
 */
export function quarterlySavePercent(
  monthlyUsd: number,
  quarterlyUsd: number,
): number | null {
  if (!Number.isFinite(monthlyUsd) || monthlyUsd <= 0) return null;
  if (!Number.isFinite(quarterlyUsd) || quarterlyUsd < 0) return null;
  const full = monthlyUsd * 3;
  const saved = 1 - quarterlyUsd / full;
  if (!Number.isFinite(saved) || saved <= 0) return 0;
  return Math.round(saved * 100);
}

function periodLabel(count: number, period: "month" | "day"): string {
  if (period === "day") {
    return count === 1 ? "1 a day" : `${count} a day`;
  }
  return copy.pricingPerMonth(count);
}

function templateNames(input: MarketingPlanInput): { free: string; pro: string } {
  const pro: string[] = [copy.pricingTemplatesFree];
  if (input.modernTemplate) pro.push("Modern");
  if (input.compactTemplate) pro.push("Compact");
  return {
    free: copy.pricingTemplatesFree,
    pro: pro.join(", "),
  };
}

function entitlementRows(input: MarketingPlanInput): {
  templates: PricingRow;
  docx: PricingRow;
  insights: PricingRow;
} {
  const templates = templateNames(input);
  return {
    templates: {
      id: "templates",
      label: copy.pricingRowTemplates,
      free: templates.free,
      pro: templates.pro,
    },
    docx: {
      id: "docx",
      label: copy.pricingRowDocx,
      free: copy.pricingNotIncluded,
      pro: input.docx ? copy.pricingIncluded : copy.pricingNotIncluded,
    },
    insights: {
      id: "insights",
      label: copy.pricingRowInsights,
      free: copy.pricingInsightsFree,
      pro: input.insightsWhatsWorking
        ? copy.pricingInsightsPro
        : copy.pricingInsightsFree,
    },
  };
}

export function presentMarketingPricing(
  input: MarketingPlanInput,
): MarketingPricingView | null {
  const free = formatPlanUsd(input.freeMonthlyUsd);
  const monthly = formatPlanUsd(input.monthlyUsd);
  const quarterly = formatPlanUsd(input.quarterlyUsd);
  if (!free || !monthly || !quarterly) return null;

  const extras = entitlementRows(input);
  const rows: PricingRow[] = [
    {
      id: "tailor",
      label: copy.pricingRowTailor,
      free: periodLabel(input.tailor.free, input.tailor.period),
      pro: periodLabel(input.tailor.pro, input.tailor.period),
    },
    {
      id: "letter",
      label: copy.pricingRowLetter,
      free: periodLabel(input.letter.free, input.letter.period),
      pro: periodLabel(input.letter.pro, input.letter.period),
    },
    extras.templates,
    extras.docx,
    extras.insights,
  ];

  return {
    free,
    monthly,
    quarterly,
    savePercent: quarterlySavePercent(input.monthlyUsd, input.quarterlyUsd),
    freeTailor: input.tailor.free,
    rows,
  };
}

export type ComparisonRowId =
  | "tailor"
  | "letter"
  | "import"
  | "analyze"
  | "tracking"
  | "templates"
  | "docx"
  | "insights"
  | "guarantee";

export type ComparisonRow = {
  id: ComparisonRowId;
  label: string;
  free: string;
  pro: string;
};

export type FoundingOfferView = {
  percent: number;
  monthly: string;
  quarterly: string;
};

/**
 * Full /pricing table. 1.0 meters and entitlements from `plans.ts`.
 * Prep kits, bullet coach, and target profiles wait for 1.1.
 */
export function presentPricingComparison(
  input: MarketingPlanInput,
): ComparisonRow[] {
  const extras = entitlementRows(input);
  return [
    {
      id: "tailor",
      label: copy.pricingRowTailor,
      free: periodLabel(input.tailor.free, input.tailor.period),
      pro: periodLabel(input.tailor.pro, input.tailor.period),
    },
    {
      id: "letter",
      label: copy.pricingRowLetter,
      free: periodLabel(input.letter.free, input.letter.period),
      pro: periodLabel(input.letter.pro, input.letter.period),
    },
    {
      id: "import",
      label: copy.pricingRowImport,
      free: periodLabel(input.resumeImport.free, input.resumeImport.period),
      pro: periodLabel(input.resumeImport.pro, input.resumeImport.period),
    },
    {
      id: "analyze",
      label: copy.pricingRowAnalyze,
      free: periodLabel(input.jobAnalysis.free, input.jobAnalysis.period),
      pro: periodLabel(input.jobAnalysis.pro, input.jobAnalysis.period),
    },
    {
      id: "tracking",
      label: copy.pricingRowTracking,
      free: copy.pricingTracking,
      pro: copy.pricingTracking,
    },
    extras.templates,
    extras.docx,
    extras.insights,
    {
      id: "guarantee",
      label: copy.pricingRowGuarantee,
      free: copy.pricingNotIncluded,
      pro: copy.pricingGuaranteePro,
    },
  ];
}

export function presentFoundingOffer(
  input: MarketingPlanInput,
): FoundingOfferView | null {
  const prices = presentCheckoutPrices({
    monthlyUsd: input.monthlyUsd,
    quarterlyUsd: input.quarterlyUsd,
    foundingPercent: input.foundingPercent,
  });
  if (!prices) return null;
  return {
    percent: prices.foundingPercent,
    monthly: prices.foundingMonthly,
    quarterly: prices.foundingQuarterly,
  };
}

export function softwareApplicationJsonLd(input: {
  name: string;
  description: string;
  url: string;
  freeUsd: number;
  monthlyUsd: number;
  quarterlyUsd: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: [
      schemaOffer(page.offerFree, input.freeUsd),
      schemaOffer(page.offerMonthly, input.monthlyUsd),
      schemaOffer(page.offerQuarterly, input.quarterlyUsd),
    ],
  };
}

function schemaOffer(name: string, price: number) {
  return {
    "@type": "Offer" as const,
    name,
    price: String(price),
    priceCurrency: "USD",
  };
}
