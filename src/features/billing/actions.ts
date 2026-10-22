"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, ok, type ActionResult } from "@/lib/result";
import { getStripe } from "@/lib/stripe";

import {
  previewAllowed,
  resolveFoundingApplication,
  subscriptionBlocksCheckout,
} from "./checkout-rules";
import { decideFounding } from "./founding-status";
import {
  STRIPE_PRICE_PRO_MONTHLY,
  STRIPE_PRICE_PRO_QUARTERLY,
} from "./plans";
import { checkoutSessionSchema, portalSessionSchema } from "./schemas";

type Interval = "MONTH" | "QUARTER";

function stripeCode(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) return error.code ?? error.type;
  return "unknown";
}

function appUrl(path: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

function priceIdFor(interval: Interval): string | null {
  return interval === "MONTH" ? STRIPE_PRICE_PRO_MONTHLY : STRIPE_PRICE_PRO_QUARTERLY;
}

async function ensureStripeCustomer(
  stripe: Stripe,
  user: { id: string; email: string; stripeCustomerId: string | null },
): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });

  const saved = await db.user.updateMany({
    where: { id: user.id, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  if (saved.count === 1) return customer.id;

  const current = await db.user.findFirst({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });
  if (current?.stripeCustomerId && current.stripeCustomerId !== customer.id) {
    try {
      await stripe.customers.del(customer.id);
    } catch (error) {
      console.error("spare stripe customer delete failed", {
        userId: user.id,
        code: stripeCode(error),
      });
    }
    return current.stripeCustomerId;
  }
  return customer.id;
}

/** Open Stripe Checkout for Monthly or 90 days. The plan changes only in the webhook. */
export async function createCheckoutSession(
  input: unknown,
): Promise<ActionResult<{ url: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = checkoutSessionSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const priceId = priceIdFor(parsed.data.interval);
  const stripe = getStripe();
  if (!stripe || !priceId) return fail("INTERNAL");

  const row = await db.user.findFirst({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      plan: true,
      stripeCustomerId: true,
    },
  });
  if (!row) return fail("NOT_FOUND");

  const decision = await decideFounding(row.email);
  const preview = previewAllowed(env.NODE_ENV, env.STRIPE_SECRET_KEY ?? null)
    ? parsed.data.previewFounding
    : undefined;
  if (decision === "blocked" && preview !== false) return fail("INTERNAL");

  const applyFounding = resolveFoundingApplication({
    eligible: decision === "apply",
    preview,
  });
  const couponId = env.STRIPE_COUPON_FOUNDING;
  if (applyFounding && !couponId) return fail("INTERNAL");

  try {
    const customerId = await ensureStripeCustomer(stripe, row);
    revalidatePath("/settings");
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    if (subscriptions.data.some((subscription) => subscriptionBlocksCheckout(subscription.status))) {
      return fail("CONFLICT");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: row.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: appUrl("/settings?upgraded=1"),
      cancel_url: appUrl("/settings?tab=plan"),
      metadata: { userId: row.id, interval: parsed.data.interval },
      subscription_data: {
        metadata: { userId: row.id, interval: parsed.data.interval },
      },
      ...(applyFounding && couponId
        ? { discounts: [{ coupon: couponId }] }
        : { allow_promotion_codes: true }),
    });

    if (!session.url) return fail("INTERNAL");
    return ok({ url: session.url });
  } catch (error) {
    console.error("checkout session failed", { userId: row.id, code: stripeCode(error) });
    return fail("INTERNAL");
  }
}

/** Open the Customer Portal for plan changes, payment methods, and cancellation. */
export async function createPortalSession(
  input: unknown,
): Promise<ActionResult<{ url: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = portalSessionSchema.safeParse(input ?? {});
  if (!parsed.success) return fail("VALIDATION");

  const stripe = getStripe();
  if (!stripe) return fail("INTERNAL");

  const row = await db.user.findFirst({
    where: { id: user.id },
    select: { id: true, stripeCustomerId: true },
  });
  if (!row) return fail("NOT_FOUND");
  if (!row.stripeCustomerId) return fail("CONFLICT");

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: appUrl("/settings?tab=plan"),
    });
    return ok({ url: session.url });
  } catch (error) {
    console.error("portal session failed", { userId: row.id, code: stripeCode(error) });
    return fail("INTERNAL");
  }
}
