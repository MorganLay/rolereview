import "server-only";

import { PLANS } from "./plans";
import { USAGE_METERS, type AllowanceCatalog } from "./present";

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
