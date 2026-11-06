import { strings } from "@/copy/strings";
import type { MarketingMeter, MarketingPlanInput } from "@/features/billing/catalog";
import type { PlanCurrency } from "@/features/billing/currency";
import { formatPlanPrice, monthlyEquivalent } from "@/features/billing/present";

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
  currency: "USD" | "CAD";
  free: string;
  monthly: string;
  quarterly: string;
  quarterlyEquivalent: string;
  savePercent: number | null;
  freeTailor: number;
  rows: PricingRow[];
};

/**
 * Percent cheaper than three monthly payments. Whole percent, or null when
 * the inputs cannot be compared.
 */
export function quarterlySavePercent(monthly: number, quarterly: number): number | null {
  if (!Number.isFinite(monthly) || monthly <= 0) return null;
  if (!Number.isFinite(quarterly) || quarterly < 0) return null;
  const full = monthly * 3;
  const saved = 1 - quarterly / full;
  if (!Number.isFinite(saved) || saved <= 0) return 0;
  return Math.round(saved * 100);
}

function periodLabel(count: number, period: "month" | "day", dailyCap?: number): string {
  if (period === "month" && dailyCap != null && dailyCap > 0) {
    return copy.pricingMonthAndDay(count, dailyCap);
  }
  if (period === "day") {
    return count === 1 ? "1 a day" : `${count} a day`;
  }
  return copy.pricingPerMonth(count);
}

function meterText(meter: MarketingMeter, side: "free" | "pro"): string {
  const cap = side === "free" ? meter.dailyCapFree : meter.dailyCapPro;
  const count = side === "free" ? meter.free : meter.pro;
  return periodLabel(count, meter.period, cap);
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
  const free = formatPlanPrice(input.freeAmount, input.currency);
  const monthly = formatPlanPrice(input.monthly, input.currency);
  const quarterly = formatPlanPrice(input.quarterly, input.currency);
  const equivalent = monthlyEquivalent(input.quarterly);
  const quarterlyEquivalent =
    equivalent == null ? null : formatPlanPrice(equivalent, input.currency);
  if (!free || !monthly || !quarterly || !quarterlyEquivalent) return null;

  const extras = entitlementRows(input);
  const rows: PricingRow[] = [
    {
      id: "tailor",
      label: copy.pricingRowTailor,
      free: meterText(input.tailor, "free"),
      pro: meterText(input.tailor, "pro"),
    },
    {
      id: "letter",
      label: copy.pricingRowLetter,
      free: meterText(input.letter, "free"),
      pro: meterText(input.letter, "pro"),
    },
    extras.templates,
    extras.docx,
    extras.insights,
  ];

  return {
    currency: input.currency,
    free,
    monthly,
    quarterly,
    quarterlyEquivalent,
    savePercent: quarterlySavePercent(input.monthly, input.quarterly),
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
      free: meterText(input.tailor, "free"),
      pro: meterText(input.tailor, "pro"),
    },
    {
      id: "letter",
      label: copy.pricingRowLetter,
      free: meterText(input.letter, "free"),
      pro: meterText(input.letter, "pro"),
    },
    {
      id: "import",
      label: copy.pricingRowImport,
      free: meterText(input.resumeImport, "free"),
      pro: meterText(input.resumeImport, "pro"),
    },
    {
      id: "analyze",
      label: copy.pricingRowAnalyze,
      free: meterText(input.jobAnalysis, "free"),
      pro: meterText(input.jobAnalysis, "pro"),
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

export function softwareApplicationJsonLd(input: {
  name: string;
  description: string;
  url: string;
  usd: MarketingPlanInput;
  cad: MarketingPlanInput;
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
      schemaOffer(page.offerFree, input.usd.freeAmount, "USD"),
      schemaOffer(page.offerFree, input.cad.freeAmount, "CAD"),
      schemaOffer(page.offerMonthly, input.usd.monthly, "USD"),
      schemaOffer(page.offerMonthly, input.cad.monthly, "CAD"),
      schemaOffer(page.offerQuarterly, input.usd.quarterly, "USD"),
      schemaOffer(page.offerQuarterly, input.cad.quarterly, "CAD"),
    ],
  };
}

function schemaOffer(name: string, price: number, currency: PlanCurrency) {
  return {
    "@type": "Offer" as const,
    name,
    price: String(price),
    priceCurrency: currency,
  };
}
