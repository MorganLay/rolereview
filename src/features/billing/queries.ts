import "server-only";

import { connection } from "next/server";

import type { BillingInterval, Plan } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { allowanceCatalog } from "./catalog";
import { USAGE_METERS, type UsageSnapshot } from "./present";
import { quotaSnapshot } from "./quota";

export type PlanBilling = {
  plan: Plan;
  billingInterval: BillingInterval | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  foundingMember: boolean;
  timeZone: string;
  usage: UsageSnapshot[];
};

/**
 * Plan fields and this period's usage for one user.
 * The page calls `requireUser()` before this.
 */
export async function getPlanBilling(userId: string): Promise<PlanBilling | null> {
  await connection();
  const user = await db.user.findFirst({
    where: { id: userId },
    select: {
      plan: true,
      billingInterval: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      foundingMember: true,
      timezone: true,
    },
  });
  if (!user) return null;

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
    timeZone: user.timezone,
    usage,
  };
}
