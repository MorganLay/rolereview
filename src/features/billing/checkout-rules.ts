/**
 * Pure checkout decisions. Stripe and the database stay outside this file.
 * docs/03-ARCHITECTURE.md → Payments.
 */

const OPEN_SUBSCRIPTION = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
]);

export type CouponRedemptions = {
  valid: boolean;
  maxRedemptions: number | null;
  timesRedeemed: number;
};

/** True when this subscription should go to the portal instead of a second checkout. */
export function subscriptionBlocksCheckout(status: string): boolean {
  return OPEN_SUBSCRIPTION.has(status);
}

/** True when the founding coupon can still be applied to a new subscription. */
export function couponCanBeRedeemed(coupon: CouponRedemptions): boolean {
  if (!coupon.valid) return false;
  if (!Number.isFinite(coupon.timesRedeemed) || coupon.timesRedeemed < 0) return false;
  if (coupon.maxRedemptions == null) return true;
  if (!Number.isFinite(coupon.maxRedemptions) || coupon.maxRedemptions <= 0) return false;
  return coupon.timesRedeemed < coupon.maxRedemptions;
}

/**
 * The discount applies only to an email that was promised it, and only while
 * the coupon itself can still be redeemed.
 */
export function foundingDiscountApplies(input: {
  foundingOffer: boolean;
  couponOpen: boolean;
}): boolean {
  return input.foundingOffer && input.couponOpen;
}

/**
 * A caller may preview the other price only in development against a test key.
 * Live keys and production ignore the flag.
 */
export function previewAllowed(nodeEnv: string, secretKey: string | null): boolean {
  return nodeEnv === "development" && (secretKey?.startsWith("sk_test_") ?? false);
}

/**
 * `preview` undefined keeps the real decision. True or false is a test-mode
 * override and must already have passed `previewAllowed`.
 */
export function resolveFoundingApplication(input: {
  eligible: boolean;
  preview: boolean | undefined;
}): boolean {
  if (input.preview === undefined) return input.eligible;
  return input.preview;
}
