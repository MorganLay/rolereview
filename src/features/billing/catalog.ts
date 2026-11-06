import "server-only";

import type { PlanCurrency } from "./currency";
import { FOUNDING_DISCOUNT_PERCENT, limitDailyCap, PLANS, proAmount } from "./plans";
import {
  presentCheckoutPrices,
  USAGE_METERS,
  type AllowanceCatalog,
  type CheckoutPrices,
  type QuotaPeriod,
} from "./present";

export type MarketingMeter = {
  free: number;
  pro: number;
  period: QuotaPeriod;
  dailyCapFree?: number;
  dailyCapPro?: number;
};

export type MarketingPlanInput = {
  currency: PlanCurrency;
  freeAmount: number;
  monthly: number;
  quarterly: number;
  foundingPercent: number;
  tailor: MarketingMeter;
  letter: MarketingMeter;
  resumeImport: MarketingMeter;
  jobAnalysis: MarketingMeter;
  modernTemplate: boolean;
  compactTemplate: boolean;
  docx: boolean;
  insightsWhatsWorking: boolean;
};

/** Free and Pro allowances for the upgrade modal. Numbers come from `plans.ts`. */
export function allowanceCatalog(): AllowanceCatalog {
  const catalog = {} as AllowanceCatalog;
  for (const meter of USAGE_METERS) {
    const free = PLANS.FREE.limits[meter];
    const pro = PLANS.PRO.limits[meter];
    if (free.period !== pro.period) {
      throw new Error(`Quota period mismatch for ${meter}.`);
    }
    catalog[meter] = {
      free: free.allowance,
      pro: pro.allowance,
      period: free.period,
      dailyCapFree: limitDailyCap(free) ?? null,
      dailyCapPro: limitDailyCap(pro) ?? null,
    };
  }
  return catalog;
}

/** Formatted Pro prices for one currency, including the founding discount. Numbers come from `plans.ts`. */
export function checkoutPrices(currency: PlanCurrency): CheckoutPrices {
  const prices = presentCheckoutPrices({
    currency,
    monthly: proAmount("MONTH", currency),
    quarterly: proAmount("QUARTER", currency),
    foundingPercent: FOUNDING_DISCOUNT_PERCENT,
  });
  if (!prices) throw new Error("Pro prices could not be formatted.");
  return prices;
}

function marketingMeter(
  kind: "IMPORT" | "ANALYZE" | "TAILOR" | "COVER_LETTER",
): MarketingMeter {
  const free = PLANS.FREE.limits[kind];
  const pro = PLANS.PRO.limits[kind];
  if (free.period !== pro.period) {
    throw new Error(`Quota period mismatch for ${kind}.`);
  }
  return {
    free: free.allowance,
    pro: pro.allowance,
    period: free.period,
    ...(limitDailyCap(free) != null || limitDailyCap(pro) != null
      ? { dailyCapFree: limitDailyCap(free) ?? 0, dailyCapPro: limitDailyCap(pro) ?? 0 }
      : {}),
  };
}

/** Homepage and /pricing. Numbers and entitlements come from `plans.ts`. */
export function marketingPlanInput(currency: PlanCurrency): MarketingPlanInput {
  return {
    currency,
    freeAmount: PLANS.FREE.price.monthly[currency],
    monthly: proAmount("MONTH", currency),
    quarterly: proAmount("QUARTER", currency),
    foundingPercent: FOUNDING_DISCOUNT_PERCENT,
    tailor: marketingMeter("TAILOR"),
    letter: marketingMeter("COVER_LETTER"),
    resumeImport: marketingMeter("IMPORT"),
    jobAnalysis: marketingMeter("ANALYZE"),
    modernTemplate: PLANS.PRO.entitlements["template:modern"],
    compactTemplate: PLANS.PRO.entitlements["template:compact"],
    docx: PLANS.PRO.entitlements.docx,
    insightsWhatsWorking: PLANS.PRO.entitlements["insights:whats-working"],
  };
}
