import "server-only";

import { FOUNDING_DISCOUNT_PERCENT, PLANS } from "./plans";
import {
  presentCheckoutPrices,
  USAGE_METERS,
  type AllowanceCatalog,
  type CheckoutPrices,
} from "./present";

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
