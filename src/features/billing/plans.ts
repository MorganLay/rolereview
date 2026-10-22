import "server-only";

import type { Plan } from "@/generated/prisma/enums";
import { env } from "@/lib/env";

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

type Limit = { readonly allowance: number; readonly period: QuotaPeriod };
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
    price: { monthlyUsd: 0, quarterlyUsd: 0 },
    limits: {
      IMPORT: { allowance: 2, period: "month" },
      ANALYZE: { allowance: 10, period: "day" },
      TAILOR: { allowance: 3, period: "month" },
      COVER_LETTER: { allowance: 1, period: "month" },
      PREP_KIT: { allowance: 1, period: "month" },
      BULLET_COACH: { allowance: 10, period: "month" },
    },
    entitlements: freeEntitlements,
  },
  PRO: {
    price: { monthlyUsd: 19, quarterlyUsd: 45 },
    limits: {
      IMPORT: { allowance: 20, period: "month" },
      ANALYZE: { allowance: 60, period: "day" },
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
    price: { monthlyUsd: number; quarterlyUsd: number };
    limits: Record<MeteredKind, Limit>;
    entitlements: Entitlements;
  }
>;

/** Percent off Pro for a founding member, for as long as they stay subscribed. */
export const FOUNDING_DISCOUNT_PERCENT = 40;

/** Null when the Stripe price ids are unset. */
export const STRIPE_PRICE_PRO_MONTHLY = env.STRIPE_PRICE_PRO_MONTHLY ?? null;
export const STRIPE_PRICE_PRO_QUARTERLY = env.STRIPE_PRICE_PRO_QUARTERLY ?? null;
