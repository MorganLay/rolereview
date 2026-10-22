import "server-only";

import { FOUNDING_DISCOUNT_PERCENT, PLANS } from "./plans";
import {
  presentCheckoutPrices,
  USAGE_METERS,
  type AllowanceCatalog,
  type CheckoutPrices,
  type QuotaPeriod,
} from "./present";

export type MarketingPlanInput = {
  freeMonthlyUsd: number;
  monthlyUsd: number;
  quarterlyUsd: number;
  tailor: { free: number; pro: number; period: QuotaPeriod };
  letter: { free: number; pro: number; period: QuotaPeriod };
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
    };
  }
  return catalog;
}

/** Formatted Pro prices, including the founding discount. Numbers come from `plans.ts`. */
export function checkoutPrices(): CheckoutPrices {
  const prices = presentCheckoutPrices({
    monthlyUsd: PLANS.PRO.price.monthlyUsd,
    quarterlyUsd: PLANS.PRO.price.quarterlyUsd,
    foundingPercent: FOUNDING_DISCOUNT_PERCENT,
  });
  if (!prices) throw new Error("Pro prices could not be formatted.");
  return prices;
}

/** Homepage pricing preview. Numbers and entitlements come from `plans.ts`. */
export function marketingPlanInput(): MarketingPlanInput {
  return {
    freeMonthlyUsd: PLANS.FREE.price.monthlyUsd,
    monthlyUsd: PLANS.PRO.price.monthlyUsd,
    quarterlyUsd: PLANS.PRO.price.quarterlyUsd,
    tailor: {
      free: PLANS.FREE.limits.TAILOR.allowance,
      pro: PLANS.PRO.limits.TAILOR.allowance,
      period: PLANS.FREE.limits.TAILOR.period,
    },
    letter: {
      free: PLANS.FREE.limits.COVER_LETTER.allowance,
      pro: PLANS.PRO.limits.COVER_LETTER.allowance,
      period: PLANS.FREE.limits.COVER_LETTER.period,
    },
    modernTemplate: PLANS.PRO.entitlements["template:modern"],
    compactTemplate: PLANS.PRO.entitlements["template:compact"],
    docx: PLANS.PRO.entitlements.docx,
    insightsWhatsWorking: PLANS.PRO.entitlements["insights:whats-working"],
  };
}
