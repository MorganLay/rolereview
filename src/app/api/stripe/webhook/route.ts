import { NextResponse } from "next/server";

import { handleStripeWebhook } from "@/features/billing/webhook";

/**
 * Stripe webhook. Signature on the raw body; no session.
 * Plan changes only happen here.
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const result = await handleStripeWebhook(payload, signature);
  return NextResponse.json(result.body, { status: result.status });
}
