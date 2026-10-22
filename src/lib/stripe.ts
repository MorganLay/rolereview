import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

/** Shared Stripe client. Null until `STRIPE_SECRET_KEY` is set. */
export function getStripe(): Stripe | null {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!globalForStripe.stripe) {
    globalForStripe.stripe = new Stripe(key, { typescript: true });
  }
  return globalForStripe.stripe;
}
