import "server-only";

import type { Plan } from "@/generated/prisma/enums";
import { env } from "@/lib/env";

import type { PlanCurrency } from "./currency";

/**
 * Limits, periods, entitlements, prices, and Stripe price ids.
 * docs/01-PRODUCT.md → Pricing, docs/03-ARCHITECTURE.md → Payments.
 */

export const METERED_KINDS = [
  "IMPORT",
  "ANALYZE",
  "TAILOR",
  "COVER_LETTER",
  "PREP_KIT",
  "BULLET_COACH",
] as const;

export type MeteredKind = (typeof METERED_KINDS)[number];

export const FEATURES = [
  "docx",
  "template:modern",
  "template:compact",
  "insights:whats-working",
  "targets:unlimited",
] as const;

export type Feature = (typeof FEATURES)[number];

export type QuotaPeriod = "month" | "day";

type Limit = {
  readonly allowance: number;
  readonly period: QuotaPeriod;
  /** UTC-day abuse ceiling. Bonus credits do not raise it. */
  readonly dailyCap?: number;
};
type Entitlements = Record<Feature, boolean>;

const freeEntitlements: Entitlements = {
  docx: false,
  "template:modern": false,
  "template:compact": false,
  "insights:whats-working": false,
  "targets:unlimited": false,
};

const proEntitlements: Entitlements = {
  docx: true,
  "template:modern": true,
  "template:compact": true,
  "insights:whats-working": true,
  "targets:unlimited": true,
};

export const PLANS = {
  FREE: {
    price: {
      monthly: { USD: 0, CAD: 0 },
      quarterly: { USD: 0, CAD: 0 },
    },
    limits: {
      IMPORT: { allowance: 2, period: "month" },
      ANALYZE: { allowance: 30, period: "month", dailyCap: 10 },
      TAILOR: { allowance: 3, period: "month" },
      COVER_LETTER: { allowance: 1, period: "month" },
      PREP_KIT: { allowance: 1, period: "month" },
      BULLET_COACH: { allowance: 10, period: "month" },
    },
    entitlements: freeEntitlements,
  },
  PRO: {
    price: {
      monthly: { USD: 24, CAD: 29 },
      quarterly: { USD: 59, CAD: 75 },
    },
    limits: {
      IMPORT: { allowance: 20, period: "month" },
      ANALYZE: { allowance: 200, period: "month", dailyCap: 40 },
      TAILOR: { allowance: 80, period: "month" },
      COVER_LETTER: { allowance: 60, period: "month" },
      PREP_KIT: { allowance: 30, period: "month" },
      BULLET_COACH: { allowance: 300, period: "month" },
    },
    entitlements: proEntitlements,
  },
} as const satisfies Record<
  Plan,
  {
    price: {
      monthly: { USD: number; CAD: number };
      quarterly: { USD: number; CAD: number };
    };
    limits: Record<MeteredKind, Limit>;
    entitlements: Entitlements;
  }
>;

/** Percent off Pro for a founding member, for as long as they stay subscribed. */
export const FOUNDING_DISCOUNT_PERCENT = 40;

/** Abuse cap when this limit has one. Absent on meters that are monthly only. */
export function limitDailyCap(limit: object): number | undefined {
  if (!("dailyCap" in limit)) return undefined;
  const value = limit.dailyCap;
  return typeof value === "number" ? value : undefined;
}

/** Current list price for one interval and currency. */
export function proAmount(
  interval: "MONTH" | "QUARTER",
  currency: PlanCurrency,
): number {
  const price = PLANS.PRO.price;
  return interval === "MONTH" ? price.monthly[currency] : price.quarterly[currency];
}

/**
 * Price ids for new checkouts. Null when that Stripe Price is unset.
 * Legacy ids stay out of checkout so an old Price cannot charge the old amount.
 */
export const STRIPE_PRICE_PRO_MONTHLY_USD = env.STRIPE_PRICE_PRO_MONTHLY_USD ?? null;
export const STRIPE_PRICE_PRO_QUARTERLY_USD = env.STRIPE_PRICE_PRO_QUARTERLY_USD ?? null;
export const STRIPE_PRICE_PRO_MONTHLY_CAD = env.STRIPE_PRICE_PRO_MONTHLY_CAD ?? null;
export const STRIPE_PRICE_PRO_QUARTERLY_CAD = env.STRIPE_PRICE_PRO_QUARTERLY_CAD ?? null;

/** Previous Prices. The webhook still maps them to an interval. Checkout does not use them. */
export const STRIPE_PRICE_PRO_MONTHLY = env.STRIPE_PRICE_PRO_MONTHLY ?? null;
export const STRIPE_PRICE_PRO_QUARTERLY = env.STRIPE_PRICE_PRO_QUARTERLY ?? null;

export function stripePriceId(
  interval: "MONTH" | "QUARTER",
  currency: PlanCurrency,
): string | null {
  if (interval === "MONTH") {
    return currency === "USD" ? STRIPE_PRICE_PRO_MONTHLY_USD : STRIPE_PRICE_PRO_MONTHLY_CAD;
  }
  return currency === "USD" ? STRIPE_PRICE_PRO_QUARTERLY_USD : STRIPE_PRICE_PRO_QUARTERLY_CAD;
}
