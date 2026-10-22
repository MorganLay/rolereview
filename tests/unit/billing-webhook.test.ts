import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const { stripeEventCreate, userFindFirst, userUpdateMany, capture, revalidatePath } =
  vi.hoisted(() => ({
    stripeEventCreate: vi.fn(),
    userFindFirst: vi.fn(),
    userUpdateMany: vi.fn(),
    capture: vi.fn(),
    revalidatePath: vi.fn(),
  }));

vi.mock("next/cache", () => ({ revalidatePath }));

vi.mock("@/lib/analytics", () => ({
  captureServerEvent: capture,
}));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_COUPON_FOUNDING: "coup_founding",
  },
}));

vi.mock("@/features/billing/plans", () => ({
  STRIPE_PRICE_PRO_MONTHLY: "price_month",
  STRIPE_PRICE_PRO_QUARTERLY: "price_quarter",
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        stripeEvent: { create: stripeEventCreate },
        user: { findFirst: userFindFirst, updateMany: userUpdateMany },
      }),
  },
}));

import { handleStripeWebhook } from "@/features/billing/webhook";

const SECRET = "whsec_test";
const USER = "11111111-1111-4111-8111-111111111111";
const PERIOD_END = 1_799_712_000;

function signed(event: Record<string, unknown>): { payload: string; signature: string } {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
  });
  return { payload, signature };
}

function envelope(
  id: string,
  type: string,
  object: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id,
    object: "event",
    api_version: "2026-01-28.clover",
    created: 1,
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
    data: { object },
  };
}

function checkoutObject(partial: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "cs_1",
    object: "checkout.session",
    client_reference_id: USER,
    customer: "cus_1",
    subscription: "sub_1",
    discounts: [{ coupon: "coup_founding" }],
    metadata: { userId: USER, interval: "MONTH" },
    ...partial,
  };
}

function subscriptionObject(partial: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sub_1",
    object: "subscription",
    status: "active",
    customer: "cus_1",
    cancel_at_period_end: false,
    metadata: { userId: USER },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          current_period_end: PERIOD_END,
          price: { id: "price_month" },
        },
      ],
    },
    ...partial,
  };
}

describe("handleStripeWebhook", () => {
  beforeEach(() => {
    stripeEventCreate.mockReset().mockResolvedValue({ id: "evt_1" });
    userFindFirst.mockReset().mockResolvedValue({
      id: USER,
      stripeCustomerId: "cus_1",
    });
    userUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    capture.mockReset().mockResolvedValue(undefined);
    revalidatePath.mockReset();
  });

  it("rejects a missing signature and an unsigned body", async () => {
    const missing = await handleStripeWebhook("{}", null, SECRET);
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ error: "signature" });

    const unsigned = await handleStripeWebhook("{}", "t=1,v1=nope", SECRET);
    expect(unsigned.status).toBe(400);
    expect(stripeEventCreate).not.toHaveBeenCalled();
  });

  it("rejects when the webhook secret is missing", async () => {
    const result = await handleStripeWebhook("{}", "t=1,v1=nope", "");
    expect(result).toEqual({ status: 500, body: { error: "unconfigured" } });
  });

  it("links checkout, sets founding, and records checkout_completed", async () => {
    const { payload, signature } = signed(
      envelope("evt_checkout", "checkout.session.completed", checkoutObject()),
    );
    userFindFirst.mockResolvedValueOnce({ id: USER, stripeCustomerId: null });

    const result = await handleStripeWebhook(payload, signature, SECRET);
    expect(result).toEqual({ status: 200, body: { received: true } });
    expect(stripeEventCreate).toHaveBeenCalledWith({
      data: { id: "evt_checkout", type: "checkout.session.completed" },
    });
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: USER },
      data: {
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        foundingMember: true,
      },
    });
    expect(capture).toHaveBeenCalledWith(USER, "checkout_completed", { interval: "MONTH" });
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("sets Pro from an active subscription and Free from a canceled one", async () => {
    const active = signed(
      envelope("evt_sub_active", "customer.subscription.created", subscriptionObject()),
    );
    const created = await handleStripeWebhook(active.payload, active.signature, SECRET);
    expect(created.status).toBe(200);
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: USER },
      data: expect.objectContaining({
        plan: "PRO",
        billingInterval: "MONTH",
        stripeSubscriptionId: "sub_1",
        subscriptionStatus: "active",
        currentPeriodEnd: new Date(PERIOD_END * 1000),
        cancelAtPeriodEnd: false,
      }),
    });

    userUpdateMany.mockClear();
    const canceled = signed(
      envelope(
        "evt_sub_canceled",
        "customer.subscription.deleted",
        subscriptionObject({ status: "canceled" }),
      ),
    );
    await handleStripeWebhook(canceled.payload, canceled.signature, SECRET);
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: USER },
      data: expect.objectContaining({
        plan: "FREE",
        subscriptionStatus: "canceled",
      }),
    });
  });

  it("keeps Pro when cancel is at period end", async () => {
    const { payload, signature } = signed(
      envelope(
        "evt_cancel_later",
        "customer.subscription.updated",
        subscriptionObject({ cancel_at_period_end: true }),
      ),
    );
    await handleStripeWebhook(payload, signature, SECRET);
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: USER },
      data: expect.objectContaining({
        plan: "PRO",
        cancelAtPeriodEnd: true,
      }),
    });
  });

  it("records invoice.payment_failed without changing the plan", async () => {
    const { payload, signature } = signed(
      envelope("evt_fail", "invoice.payment_failed", {
        id: "in_1",
        object: "invoice",
        customer: "cus_1",
      }),
    );
    const result = await handleStripeWebhook(payload, signature, SECRET);
    expect(result.status).toBe(200);
    expect(userFindFirst).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_1" },
      select: { id: true },
    });
    expect(userUpdateMany).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });

  it("treats a replayed event as a no-op", async () => {
    stripeEventCreate.mockRejectedValueOnce({ code: "P2002" });
    const { payload, signature } = signed(
      envelope("evt_dup", "customer.subscription.updated", subscriptionObject()),
    );
    const result = await handleStripeWebhook(payload, signature, SECRET);
    expect(result).toEqual({ status: 200, body: { received: true } });
    expect(userUpdateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("stores an unhandled type and does not touch the user", async () => {
    const { payload, signature } = signed(
      envelope("evt_other", "customer.created", { id: "cus_1", object: "customer" }),
    );
    const result = await handleStripeWebhook(payload, signature, SECRET);
    expect(result.status).toBe(200);
    expect(stripeEventCreate).toHaveBeenCalledWith({
      data: { id: "evt_other", type: "customer.created" },
    });
    expect(userUpdateMany).not.toHaveBeenCalled();
  });
});
