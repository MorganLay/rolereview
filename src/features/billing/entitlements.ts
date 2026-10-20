import "server-only";

import type { Plan } from "@/generated/prisma/enums";

import { PLANS, type Feature } from "./plans";

/** Pro-only features. Deny with PRO_REQUIRED in the action that calls this. */
export function can(user: { plan: Plan }, feature: Feature): boolean {
  return PLANS[user.plan].entitlements[feature];
}
