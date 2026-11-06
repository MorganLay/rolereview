"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";

import { rememberPlanCurrency } from "./currency-request";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, ok, type ActionResult } from "@/lib/result";
import { getStripe } from "@/lib/stripe";

import { subscriptionBlocksCheckout } from "./checkout-rules";
import { stripePriceId } from "./plans";
import { checkoutSessionSchema, planCurrencySchema, portalSessionSchema } from "./schemas";

function stripeCode(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) return error.code ?? error.type;
  return "unknown";
}

function appUrl(path: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

/** Save the currency used on pricing, checkout, and Settings. */
export async function setPlanCurrency(
  input: unknown,
): Promise<ActionResult<{ currency: "USD" | "CAD" }>> {
  const parsed = planCurrencySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  await rememberPlanCurrency(parsed.data.currency);
  revalidatePath("/", "layout");
  return ok({ currency: parsed.data.currency });
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

  const priceId = stripePriceId(parsed.data.interval, parsed.data.currency);
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

    await rememberPlanCurrency(parsed.data.currency);
    const session = await stripe.checkout.sessions.create({
      ui_mode: "hosted_page",
      mode: "subscription",
      customer: customerId,
      client_reference_id: row.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: appUrl("/settings?upgraded=1"),
      cancel_url: appUrl("/settings?tab=plan"),
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: true },
      allow_promotion_codes: false,
      payment_method_collection: "always",
      submit_type: "auto",
      integration_identifier: "hosted_web_0001",
      origin_context: "web",
      customer_update: { address: "auto" },
      metadata: {
        userId: row.id,
        interval: parsed.data.interval,
        currency: parsed.data.currency,
      },
      subscription_data: {
        metadata: {
          userId: row.id,
          interval: parsed.data.interval,
          currency: parsed.data.currency,
        },
      },
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
