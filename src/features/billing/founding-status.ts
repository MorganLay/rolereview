import "server-only";

import Stripe from "stripe";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

import { couponCanBeRedeemed } from "./checkout-rules";

export type FoundingDecision = "apply" | "skip" | "blocked";

type CouponState = "open" | "closed" | "unknown";

function stripeCode(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) return error.code ?? error.type;
  return "unknown";
}

/** Whether the configured founding coupon can still be redeemed. Failures are unknown. */
export async function readFoundingCoupon(): Promise<CouponState> {
  const couponId = env.STRIPE_COUPON_FOUNDING;
  const stripe = getStripe();
  if (!couponId || !stripe) return "unknown";

  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    const state = couponCanBeRedeemed({
      valid: coupon.valid,
      maxRedemptions: coupon.max_redemptions,
      timesRedeemed: coupon.times_redeemed,
    })
      ? "open"
      : "closed";
    return state;
  } catch (error) {
    console.error("founding coupon lookup failed", { code: stripeCode(error) });
    return "unknown";
  }
}

/** True when this email was promised founding-member pricing on the waitlist. */
export async function userHasFoundingOffer(email: string): Promise<boolean> {
  const lead = await db.lead.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      foundingOffer: true,
    },
    select: { id: true },
  });
  return lead !== null;
}

/**
 * Apply the coupon, charge full price, or refuse checkout.
 * Refuse when the email was promised the discount and we cannot confirm the coupon.
 */
export async function decideFounding(email: string): Promise<FoundingDecision> {
  const offer = await userHasFoundingOffer(email);
  if (!offer) return "skip";
  if (!env.STRIPE_COUPON_FOUNDING || !env.STRIPE_SECRET_KEY) return "blocked";
  const state = await readFoundingCoupon();
  if (state === "unknown") return "blocked";
  if (state === "closed") return "skip";
  return "apply";
}
