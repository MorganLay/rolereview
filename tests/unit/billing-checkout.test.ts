import { describe, expect, it } from "vitest";

import {
  couponCanBeRedeemed,
  foundingDiscountApplies,
  previewAllowed,
  resolveFoundingApplication,
  subscriptionBlocksCheckout,
  type CouponRedemptions,
} from "@/features/billing/checkout-rules";

function coupon(partial: Partial<CouponRedemptions>): CouponRedemptions {
  return {
    valid: true,
    maxRedemptions: 100,
    timesRedeemed: 0,
    ...partial,
  };
}

describe("subscriptionBlocksCheckout", () => {
  const cases: Array<{ status: string; blocks: boolean }> = [
    { status: "active", blocks: true },
    { status: "trialing", blocks: true },
    { status: "past_due", blocks: true },
    { status: "unpaid", blocks: true },
    { status: "paused", blocks: true },
    { status: "canceled", blocks: false },
    { status: "incomplete", blocks: false },
    { status: "incomplete_expired", blocks: false },
    { status: "", blocks: false },
    { status: "ACTIVE", blocks: false },
  ];

  it.each(cases)("$status blocks=$blocks", ({ status, blocks }) => {
    expect(subscriptionBlocksCheckout(status)).toBe(blocks);
  });
});

describe("couponCanBeRedeemed", () => {
  const cases: Array<{ name: string; coupon: CouponRedemptions; open: boolean }> = [
    { name: "unused coupon with a cap", coupon: coupon({}), open: true },
    { name: "one redemption left", coupon: coupon({ timesRedeemed: 99 }), open: true },
    { name: "cap reached", coupon: coupon({ timesRedeemed: 100 }), open: false },
    { name: "over the cap", coupon: coupon({ timesRedeemed: 101 }), open: false },
    { name: "marked invalid", coupon: coupon({ valid: false, timesRedeemed: 0 }), open: false },
    { name: "no cap", coupon: coupon({ maxRedemptions: null, timesRedeemed: 500 }), open: true },
    { name: "zero cap", coupon: coupon({ maxRedemptions: 0 }), open: false },
    { name: "negative cap", coupon: coupon({ maxRedemptions: -1 }), open: false },
    { name: "non-finite cap", coupon: coupon({ maxRedemptions: Number.NaN }), open: false },
    { name: "negative redemptions", coupon: coupon({ timesRedeemed: -1 }), open: false },
    { name: "non-finite redemptions", coupon: coupon({ timesRedeemed: Number.NaN }), open: false },
  ];

  it.each(cases)("$name", ({ coupon: value, open }) => {
    expect(couponCanBeRedeemed(value)).toBe(open);
  });
});

describe("foundingDiscountApplies", () => {
  it("requires both the promised email and an open coupon", () => {
    expect(foundingDiscountApplies({ foundingOffer: true, couponOpen: true })).toBe(true);
    expect(foundingDiscountApplies({ foundingOffer: true, couponOpen: false })).toBe(false);
    expect(foundingDiscountApplies({ foundingOffer: false, couponOpen: true })).toBe(false);
    expect(foundingDiscountApplies({ foundingOffer: false, couponOpen: false })).toBe(false);
  });
});

describe("previewAllowed", () => {
  it("allows the price switch only for a development test key", () => {
    expect(previewAllowed("development", "sk_test_123")).toBe(true);
    expect(previewAllowed("development", "sk_live_123")).toBe(false);
    expect(previewAllowed("production", "sk_test_123")).toBe(false);
    expect(previewAllowed("test", "sk_test_123")).toBe(false);
    expect(previewAllowed("development", null)).toBe(false);
    expect(previewAllowed("development", "")).toBe(false);
  });
});

describe("resolveFoundingApplication", () => {
  it("keeps the real decision unless a preview flag is set", () => {
    expect(resolveFoundingApplication({ eligible: true, preview: undefined })).toBe(true);
    expect(resolveFoundingApplication({ eligible: false, preview: undefined })).toBe(false);
    expect(resolveFoundingApplication({ eligible: false, preview: true })).toBe(true);
    expect(resolveFoundingApplication({ eligible: true, preview: false })).toBe(false);
  });
});
