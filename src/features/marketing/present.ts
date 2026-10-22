import { strings } from "@/copy/strings";
import type { MarketingPlanInput } from "@/features/billing/catalog";
import { formatPlanUsd } from "@/features/billing/present";

const copy = strings.marketing.home;

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

export function presentMarketingPricing(
  input: MarketingPlanInput,
): MarketingPricingView | null {
  const free = formatPlanUsd(input.freeMonthlyUsd);
  const monthly = formatPlanUsd(input.monthlyUsd);
  const quarterly = formatPlanUsd(input.quarterlyUsd);
  if (!free || !monthly || !quarterly) return null;

  const templates = templateNames(input);
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
    {
      id: "templates",
      label: copy.pricingRowTemplates,
      free: templates.free,
      pro: templates.pro,
    },
    {
      id: "docx",
      label: copy.pricingRowDocx,
      free: copy.pricingNotIncluded,
      pro: input.docx ? copy.pricingIncluded : copy.pricingNotIncluded,
    },
    {
      id: "insights",
      label: copy.pricingRowInsights,
      free: copy.pricingInsightsFree,
      pro: input.insightsWhatsWorking
        ? copy.pricingInsightsPro
        : copy.pricingInsightsFree,
    },
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
