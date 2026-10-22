import "server-only";

import { cache } from "react";
import { connection } from "next/server";

import type { BillingInterval, Plan } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { allowanceCatalog } from "./catalog";
import { decideFounding } from "./founding-status";
import { USAGE_METERS, type UsageSnapshot } from "./present";
import { quotaSnapshot } from "./quota";

export type PlanBilling = {
  plan: Plan;
  billingInterval: BillingInterval | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  foundingMember: boolean;
  foundingEligible: boolean;
  hasCustomer: boolean;
  timeZone: string;
  usage: UsageSnapshot[];
};

export type CheckoutContext = {
  plan: Plan;
  foundingEligible: boolean;
  hasCustomer: boolean;
};

/**
 * Whether this account should see the founding price, and whether a Stripe
 * customer already exists. Cached for the request.
 */
export const getCheckoutContext = cache(async (userId: string): Promise<CheckoutContext | null> => {
  await connection();
  const user = await db.user.findFirst({
    where: { id: userId },
    select: { email: true, plan: true, stripeCustomerId: true },
  });
  if (!user) return null;
  const decision = await decideFounding(user.email);
  return {
    plan: user.plan,
    foundingEligible: decision === "apply",
    hasCustomer: user.stripeCustomerId !== null,
  };
});

/**
 * Plan fields and this period's usage for one user.
 * The page calls `requireUser()` before this.
 */
export async function getPlanBilling(userId: string): Promise<PlanBilling | null> {
  await connection();
  const [user, checkout] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: {
        plan: true,
        billingInterval: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        foundingMember: true,
        timezone: true,
      },
    }),
    getCheckoutContext(userId),
  ]);
  if (!user || !checkout) return null;

  const catalog = allowanceCatalog();
  const usage = await Promise.all(
    USAGE_METERS.map(async (meter) => {
      const snapshot = await quotaSnapshot({ id: userId, plan: user.plan }, meter);
      const row: UsageSnapshot = {
        meter,
        used: snapshot.used,
        allowance: snapshot.allowance,
        bonus: snapshot.bonus,
        period: catalog[meter].period,
      };
      return row;
    }),
  );

  return {
    plan: user.plan,
    billingInterval: user.billingInterval,
    currentPeriodEnd: user.currentPeriodEnd,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    foundingMember: user.foundingMember,
    foundingEligible: checkout.foundingEligible,
    hasCustomer: checkout.hasCustomer,
    timeZone: user.timezone,
    usage,
  };
}
