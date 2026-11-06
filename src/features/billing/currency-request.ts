import "server-only";

import { cookies, headers } from "next/headers";

import { env } from "@/lib/env";

import {
  PLAN_CURRENCY_COOKIE,
  resolvePlanCurrency,
  type PlanCurrency,
} from "./currency";

/** Cookie first, then the edge country header, then USD. */
export async function requestPlanCurrency(): Promise<PlanCurrency> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return resolvePlanCurrency({
    cookie: cookieStore.get(PLAN_CURRENCY_COOKIE)?.value,
    country:
      headerStore.get("x-vercel-ip-country") ?? headerStore.get("cf-ipcountry"),
  });
}

/** Remember the currency the visitor chose, for a year. */
export async function rememberPlanCurrency(currency: PlanCurrency): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PLAN_CURRENCY_COOKIE, currency, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
  });
}
