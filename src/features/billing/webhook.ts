import "server-only";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";

import { type Prisma } from "@/generated/prisma/client";
import { captureServerEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import {
  STRIPE_PRICE_PRO_MONTHLY,
  STRIPE_PRICE_PRO_QUARTERLY,
} from "./plans";
import {
  checkoutInterval,
  checkoutLinkPatch,
  checkoutUserId,
  firstItemPeriodEnd,
  firstItemPriceId,
  foundingCouponApplied,
  invoiceCustomerId,
  isUserId,
  stripeId,
  subscriptionPatch,
  type PriceCatalog,
} from "./webhook-map";

type WebhookTx = Prisma.TransactionClient;

type AppliedEvent = {
  touched: boolean;
  checkout?: { userId: string; interval: "MONTH" | "QUARTER" };
};

export type WebhookResult = {
  status: number;
  body: { received?: true; error?: string };
};

function priceCatalog(): PriceCatalog {
  return {
    monthly: STRIPE_PRICE_PRO_MONTHLY,
    quarterly: STRIPE_PRICE_PRO_QUARTERLY,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

function isSignatureError(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeSignatureVerificationError;
}

function revalidateBilling() {
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

/**
 * Verify the Stripe signature, record the event, then apply it.
 * A duplicate event id is a no-op. The plan changes only here.
 */
export async function handleStripeWebhook(
  payload: string,
  signature: string | null,
  secret: string | undefined = env.STRIPE_WEBHOOK_SECRET,
): Promise<WebhookResult> {
  if (!secret) return { status: 500, body: { error: "unconfigured" } };
  if (!signature) return { status: 400, body: { error: "signature" } };

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    if (isSignatureError(error)) {
      return { status: 400, body: { error: "signature" } };
    }
    console.error("stripe webhook verify failed", { code: "verify" });
    return { status: 400, body: { error: "signature" } };
  }

  let applied: AppliedEvent = { touched: false };
  try {
    applied = await db.$transaction(async (tx) => {
      await tx.stripeEvent.create({
        data: { id: event.id, type: event.type },
      });
      return applyStripeEvent(event, tx);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { status: 200, body: { received: true } };
    }
    console.error("stripe webhook failed", {
      eventId: event.id,
      type: event.type,
      code: "handler",
    });
    return { status: 500, body: { error: "handler" } };
  }

  if (applied.touched) revalidateBilling();
  if (applied.checkout) {
    await captureServerEvent(applied.checkout.userId, "checkout_completed", {
      interval: applied.checkout.interval,
    });
  }

  return { status: 200, body: { received: true } };
}

export async function applyStripeEvent(
  event: Stripe.Event,
  tx: WebhookTx,
): Promise<AppliedEvent> {
  switch (event.type) {
    case "checkout.session.completed":
      return applyCheckout(tx, event.data.object as Stripe.Checkout.Session);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return applySubscription(tx, event.data.object as Stripe.Subscription);
    case "invoice.payment_failed":
      return applyPaymentFailed(tx, event.data.object as Stripe.Invoice);
    default:
      return { touched: false };
  }
}

async function applyCheckout(
  tx: WebhookTx,
  session: Stripe.Checkout.Session,
): Promise<AppliedEvent> {
  const userId = checkoutUserId({
    client_reference_id: session.client_reference_id,
    metadata: session.metadata,
  });
  if (!userId) return { touched: false };

  const user = await tx.user.findFirst({
    where: { id: userId },
    select: { id: true, stripeCustomerId: true },
  });
  if (!user) return { touched: false };

  const patch = checkoutLinkPatch({
    customerId: stripeId(session.customer),
    subscriptionId: stripeId(session.subscription),
    founding: foundingCouponApplied(
      session.discounts,
      env.STRIPE_COUPON_FOUNDING ?? null,
    ),
    existingCustomerId: user.stripeCustomerId,
  });
  if (!patch) {
    if (stripeId(session.customer) && user.stripeCustomerId) {
      console.error("stripe customer mismatch", {
        userId: user.id,
        type: "checkout.session.completed",
      });
    }
    return { touched: false };
  }

  await tx.user.updateMany({ where: { id: user.id }, data: patch });
  const interval = checkoutInterval(session.metadata);
  return {
    touched: true,
    ...(interval ? { checkout: { userId: user.id, interval } } : {}),
  };
}

async function applySubscription(
  tx: WebhookTx,
  subscription: Stripe.Subscription,
): Promise<AppliedEvent> {
  const user = await findSubscriptionUser(tx, subscription);
  if (!user) return { touched: false };

  const items = subscription.items.data;
  const patch = subscriptionPatch({
    status: subscription.status,
    subscriptionId: subscription.id,
    customerId: stripeId(subscription.customer),
    existingCustomerId: user.stripeCustomerId,
    priceId: firstItemPriceId(items),
    periodEnd: firstItemPeriodEnd(items),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    prices: priceCatalog(),
  });

  await tx.user.updateMany({ where: { id: user.id }, data: patch });
  return { touched: true };
}

async function applyPaymentFailed(
  tx: WebhookTx,
  invoice: Stripe.Invoice,
): Promise<AppliedEvent> {
  const customerId = invoiceCustomerId(invoice);
  if (!customerId) return { touched: false };
  const user = await tx.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!user) return { touched: false };
  return { touched: true };
}

async function findSubscriptionUser(
  tx: WebhookTx,
  subscription: Stripe.Subscription,
): Promise<{ id: string; stripeCustomerId: string | null } | null> {
  const bySubscription = await tx.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, stripeCustomerId: true },
  });
  if (bySubscription) return bySubscription;

  const customerId = stripeId(subscription.customer);
  if (customerId) {
    const byCustomer = await tx.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, stripeCustomerId: true },
    });
    if (byCustomer) return byCustomer;
  }

  const metaUserId = subscription.metadata?.userId;
  if (!isUserId(metaUserId)) return null;
  return tx.user.findFirst({
    where: { id: metaUserId },
    select: { id: true, stripeCustomerId: true },
  });
}
