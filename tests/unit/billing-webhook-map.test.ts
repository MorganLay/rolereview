import { describe, expect, it } from "vitest";

import {
  billingIntervalFromPriceId,
  checkoutInterval,
  checkoutLinkPatch,
  checkoutUserId,
  firstItemPeriodEnd,
  firstItemPriceId,
  foundingCouponApplied,
  invoiceCustomerId,
  isUserId,
  periodEndFromUnix,
  planFromSubscriptionStatus,
  showsPaymentFailedBanner,
  stripeId,
  subscriptionPatch,
} from "@/features/billing/webhook-map";

const USER = "11111111-1111-4111-8111-111111111111";
const PRICES = { monthly: "price_month", quarterly: "price_quarter" };

describe("stripeId", () => {
  it("reads a string, an expanded object, and blanks", () => {
    expect(stripeId("cus_1")).toBe("cus_1");
    expect(stripeId({ id: "sub_1" })).toBe("sub_1");
    expect(stripeId("  ")).toBeNull();
    expect(stripeId(null)).toBeNull();
    expect(stripeId(undefined)).toBeNull();
    expect(stripeId({ id: "" })).toBeNull();
  });
});

describe("isUserId", () => {
  it("accepts a uuid and rejects other ids", () => {
    expect(isUserId(USER)).toBe(true);
    expect(isUserId("cus_1")).toBe(false);
    expect(isUserId("")).toBe(false);
    expect(isUserId(null)).toBe(false);
  });
});

describe("planFromSubscriptionStatus", () => {
  const cases: Array<{ status: string; plan: "FREE" | "PRO" }> = [
    { status: "active", plan: "PRO" },
    { status: "trialing", plan: "PRO" },
    { status: "past_due", plan: "FREE" },
    { status: "unpaid", plan: "FREE" },
    { status: "canceled", plan: "FREE" },
    { status: "incomplete", plan: "FREE" },
    { status: "incomplete_expired", plan: "FREE" },
    { status: "paused", plan: "FREE" },
    { status: "", plan: "FREE" },
    { status: "ACTIVE", plan: "FREE" },
  ];

  it.each(cases)("$status → $plan", ({ status, plan }) => {
    expect(planFromSubscriptionStatus(status)).toBe(plan);
  });
});

describe("showsPaymentFailedBanner", () => {
  it("is only past_due or unpaid", () => {
    expect(showsPaymentFailedBanner("past_due")).toBe(true);
    expect(showsPaymentFailedBanner("unpaid")).toBe(true);
    expect(showsPaymentFailedBanner("active")).toBe(false);
    expect(showsPaymentFailedBanner("canceled")).toBe(false);
    expect(showsPaymentFailedBanner(null)).toBe(false);
    expect(showsPaymentFailedBanner(undefined)).toBe(false);
  });
});

describe("billingIntervalFromPriceId", () => {
  it("maps catalog ids and ignores anything else", () => {
    expect(billingIntervalFromPriceId("price_month", PRICES)).toBe("MONTH");
    expect(billingIntervalFromPriceId("price_quarter", PRICES)).toBe("QUARTER");
    expect(billingIntervalFromPriceId("price_other", PRICES)).toBeNull();
    expect(billingIntervalFromPriceId(null, PRICES)).toBeNull();
    expect(billingIntervalFromPriceId("price_month", { monthly: null, quarterly: "price_quarter" })).toBeNull();
  });
});

describe("period and price from items", () => {
  it("reads the first item and rejects unusable unix times", () => {
    expect(firstItemPeriodEnd([{ current_period_end: 1_700_000_000 }])).toEqual(
      new Date(1_700_000_000 * 1000),
    );
    expect(firstItemPeriodEnd([])).toBeNull();
    expect(firstItemPeriodEnd(undefined)).toBeNull();
    expect(periodEndFromUnix(0)).toBeNull();
    expect(periodEndFromUnix(-1)).toBeNull();
    expect(periodEndFromUnix(Number.NaN)).toBeNull();
    expect(firstItemPriceId([{ price: "price_month" }])).toBe("price_month");
    expect(firstItemPriceId([{ price: { id: "price_quarter" } }])).toBe("price_quarter");
    expect(firstItemPriceId([{ price: null }])).toBeNull();
  });
});

describe("foundingCouponApplied", () => {
  it("matches the founding coupon as a string or an expanded object", () => {
    expect(foundingCouponApplied([{ coupon: "coup_f" }], "coup_f")).toBe(true);
    expect(foundingCouponApplied([{ coupon: { id: "coup_f" } }], "coup_f")).toBe(true);
    expect(foundingCouponApplied([{ coupon: "coup_other" }], "coup_f")).toBe(false);
    expect(foundingCouponApplied([{ coupon: null }], "coup_f")).toBe(false);
    expect(foundingCouponApplied([], "coup_f")).toBe(false);
    expect(foundingCouponApplied(null, "coup_f")).toBe(false);
    expect(foundingCouponApplied([{ coupon: "coup_f" }], null)).toBe(false);
  });
});

describe("checkoutUserId", () => {
  it("prefers client_reference_id and falls back to metadata", () => {
    expect(checkoutUserId({ client_reference_id: USER })).toBe(USER);
    expect(
      checkoutUserId({
        client_reference_id: "not-a-user",
        metadata: { userId: USER },
      }),
    ).toBe(USER);
    expect(checkoutUserId({ client_reference_id: "cus_1", metadata: { userId: "cus_1" } })).toBeNull();
    expect(checkoutUserId({})).toBeNull();
  });
});

describe("checkoutInterval", () => {
  it("reads MONTH or QUARTER from metadata", () => {
    expect(checkoutInterval({ interval: "MONTH" })).toBe("MONTH");
    expect(checkoutInterval({ interval: "QUARTER" })).toBe("QUARTER");
    expect(checkoutInterval({ interval: "year" })).toBeNull();
    expect(checkoutInterval({})).toBeNull();
    expect(checkoutInterval(null)).toBeNull();
  });
});

describe("checkoutLinkPatch", () => {
  it("links customer and subscription, and sets founding only when the coupon applied", () => {
    expect(
      checkoutLinkPatch({
        customerId: "cus_1",
        subscriptionId: "sub_1",
        founding: true,
        existingCustomerId: null,
      }),
    ).toEqual({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      foundingMember: true,
    });
    expect(
      checkoutLinkPatch({
        customerId: "cus_1",
        subscriptionId: null,
        founding: false,
        existingCustomerId: "cus_1",
      }),
    ).toEqual({ stripeCustomerId: "cus_1" });
  });

  it("refuses a different customer already on the account", () => {
    expect(
      checkoutLinkPatch({
        customerId: "cus_new",
        subscriptionId: "sub_1",
        founding: true,
        existingCustomerId: "cus_old",
      }),
    ).toBeNull();
  });

  it("returns null when there is nothing to write", () => {
    expect(
      checkoutLinkPatch({
        customerId: null,
        subscriptionId: null,
        founding: false,
        existingCustomerId: null,
      }),
    ).toBeNull();
  });
});

describe("subscriptionPatch", () => {
  it("sets Pro, the interval, and the period end from the item", () => {
    const end = new Date("2026-11-15T00:00:00.000Z");
    expect(
      subscriptionPatch({
        status: "active",
        subscriptionId: "sub_1",
        customerId: "cus_1",
        existingCustomerId: null,
        priceId: "price_month",
        periodEnd: end,
        cancelAtPeriodEnd: false,
        prices: PRICES,
      }),
    ).toEqual({
      plan: "PRO",
      billingInterval: "MONTH",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      subscriptionStatus: "active",
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
    });
  });

  it("stays Pro when cancel is at period end, then Free when canceled", () => {
    const end = new Date("2026-11-15T00:00:00.000Z");
    const canceling = subscriptionPatch({
      status: "active",
      subscriptionId: "sub_1",
      customerId: "cus_1",
      existingCustomerId: "cus_1",
      priceId: "price_quarter",
      periodEnd: end,
      cancelAtPeriodEnd: true,
      prices: PRICES,
    });
    expect(canceling.plan).toBe("PRO");
    expect(canceling.cancelAtPeriodEnd).toBe(true);
    expect(canceling.billingInterval).toBe("QUARTER");

    const canceled = subscriptionPatch({
      status: "canceled",
      subscriptionId: "sub_1",
      customerId: "cus_1",
      existingCustomerId: "cus_1",
      priceId: "price_quarter",
      periodEnd: end,
      cancelAtPeriodEnd: false,
      prices: PRICES,
    });
    expect(canceled.plan).toBe("FREE");
    expect(canceled.subscriptionStatus).toBe("canceled");
  });

  it("omits a mismatched customer and an unknown price", () => {
    const patch = subscriptionPatch({
      status: "past_due",
      subscriptionId: "sub_1",
      customerId: "cus_new",
      existingCustomerId: "cus_old",
      priceId: "price_other",
      periodEnd: null,
      cancelAtPeriodEnd: false,
      prices: PRICES,
    });
    expect(patch.plan).toBe("FREE");
    expect(patch.stripeCustomerId).toBeUndefined();
    expect(patch.billingInterval).toBeUndefined();
    expect(patch.currentPeriodEnd).toBeNull();
  });
});

describe("invoiceCustomerId", () => {
  it("reads the customer from the invoice", () => {
    expect(invoiceCustomerId({ customer: "cus_1" })).toBe("cus_1");
    expect(invoiceCustomerId({ customer: { id: "cus_1" } })).toBe("cus_1");
    expect(invoiceCustomerId({})).toBeNull();
  });
});
