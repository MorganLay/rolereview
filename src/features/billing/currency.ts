/**
 * Plan currency. Amounts stay in `plans.ts`. This file only names the two
 * list currencies and picks one from a saved choice or a country code.
 */

export const PLAN_CURRENCIES = ["USD", "CAD"] as const;

export type PlanCurrency = (typeof PLAN_CURRENCIES)[number];

/** HttpOnly cookie. Checkout, the pricing pages, and Settings read the same value. */
export const PLAN_CURRENCY_COOKIE = "rr-plan-currency";

export function isPlanCurrency(value: string | null | undefined): value is PlanCurrency {
  return value === "USD" || value === "CAD";
}

/**
 * A saved choice wins. Otherwise Canada is CAD and every other country,
 * including a missing country, is USD.
 */
export function resolvePlanCurrency(input: {
  cookie: string | null | undefined;
  country: string | null | undefined;
}): PlanCurrency {
  const chosen = input.cookie?.trim().toUpperCase();
  if (isPlanCurrency(chosen)) return chosen;
  if (input.country?.trim().toUpperCase() === "CA") return "CAD";
  return "USD";
}
