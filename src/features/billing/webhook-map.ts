/**
 * Pure Stripe webhook mapping. Database and the Stripe client stay outside.
 * docs/03-ARCHITECTURE.md → Payments.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRO_STATUSES = new Set(["active", "trialing"]);
const PAYMENT_FAILED_STATUSES = new Set(["past_due", "unpaid"]);

export type StripeRef = string | { id: string };

export type PriceCatalog = {
  monthly: string | null;
  quarterly: string | null;
};

export type CheckoutLinkPatch = {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  foundingMember?: true;
};

export type SubscriptionPatch = {
  plan: "FREE" | "PRO";
  billingInterval?: "MONTH" | "QUARTER";
  stripeCustomerId?: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/** Stripe objects are either an id string or an expanded `{ id }`. */
export function stripeId(value: StripeRef | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const id = value.trim();
    return id.length > 0 ? id : null;
  }
  const id = value.id?.trim();
  return id ? id : null;
}

export function isUserId(value: string | null | undefined): value is string {
  return Boolean(value && UUID.test(value));
}

/** PRO only while Stripe says the subscription is active or trialing. */
export function planFromSubscriptionStatus(status: string): "FREE" | "PRO" {
  return PRO_STATUSES.has(status) ? "PRO" : "FREE";
}

export function showsPaymentFailedBanner(status: string | null | undefined): boolean {
  return status != null && PAYMENT_FAILED_STATUSES.has(status);
}

export function billingIntervalFromPriceId(
  priceId: string | null,
  catalog: PriceCatalog,
): "MONTH" | "QUARTER" | null {
  if (!priceId) return null;
  if (catalog.monthly && priceId === catalog.monthly) return "MONTH";
  if (catalog.quarterly && priceId === catalog.quarterly) return "QUARTER";
  return null;
}

export function periodEndFromUnix(seconds: number | null | undefined): Date | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function firstItemPeriodEnd(
  items: Array<{ current_period_end?: number }> | undefined,
): Date | null {
  return periodEndFromUnix(items?.[0]?.current_period_end);
}

export function firstItemPriceId(
  items: Array<{ price?: StripeRef | null }> | undefined,
): string | null {
  return stripeId(items?.[0]?.price ?? null);
}

export function foundingCouponApplied(
  discounts: Array<{ coupon?: StripeRef | null }> | null | undefined,
  foundingCouponId: string | null,
): boolean {
  if (!foundingCouponId || !discounts) return false;
  return discounts.some((discount) => stripeId(discount.coupon ?? null) === foundingCouponId);
}

export function checkoutUserId(session: {
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
}): string | null {
  const fromRef = session.client_reference_id?.trim() ?? "";
  if (isUserId(fromRef)) return fromRef;
  const fromMeta = session.metadata?.userId?.trim() ?? "";
  return isUserId(fromMeta) ? fromMeta : null;
}

export function checkoutInterval(
  metadata: Record<string, string> | null | undefined,
): "MONTH" | "QUARTER" | null {
  const value = metadata?.interval;
  return value === "MONTH" || value === "QUARTER" ? value : null;
}

export function checkoutLinkPatch(input: {
  customerId: string | null;
  subscriptionId: string | null;
  founding: boolean;
  existingCustomerId: string | null;
}): CheckoutLinkPatch | null {
  if (
    input.customerId &&
    input.existingCustomerId &&
    input.existingCustomerId !== input.customerId
  ) {
    return null;
  }
  const patch: CheckoutLinkPatch = {};
  if (input.customerId) patch.stripeCustomerId = input.customerId;
  if (input.subscriptionId) patch.stripeSubscriptionId = input.subscriptionId;
  if (input.founding) patch.foundingMember = true;
  return Object.keys(patch).length > 0 ? patch : null;
}

export function subscriptionPatch(input: {
  status: string;
  subscriptionId: string;
  customerId: string | null;
  existingCustomerId: string | null;
  priceId: string | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  prices: PriceCatalog;
}): SubscriptionPatch {
  const interval = billingIntervalFromPriceId(input.priceId, input.prices);
  const customerId =
    input.customerId &&
    (!input.existingCustomerId || input.existingCustomerId === input.customerId)
      ? input.customerId
      : undefined;
  return {
    plan: planFromSubscriptionStatus(input.status),
    ...(interval ? { billingInterval: interval } : {}),
    ...(customerId ? { stripeCustomerId: customerId } : {}),
    stripeSubscriptionId: input.subscriptionId,
    subscriptionStatus: input.status,
    currentPeriodEnd: input.periodEnd,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
  };
}

export function invoiceCustomerId(invoice: {
  customer?: StripeRef | null;
}): string | null {
  return stripeId(invoice.customer ?? null);
}
