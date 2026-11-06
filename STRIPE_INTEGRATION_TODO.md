# Stripe Checkout setup

Hosted Checkout is already wired. The session is created in [src/features/billing/actions.ts](src/features/billing/actions.ts). No sample placeholders were added to that call.

## Values to replace

`mode`, `success_url`, `cancel_url`, and `line_items` already use real values.

| Field | Current value | What to set |
|---|---|---|
| mode | `subscription` | Leave it. Pro is a recurring plan. |
| success_url | `/settings?upgraded=1` on the app URL | Leave it. |
| cancel_url | `/settings?tab=plan` on the app URL | Leave it. |
| line_items[].price | The USD or CAD Price id from `plans.ts` | Put the four live Price ids in Vercel Production: `STRIPE_PRICE_PRO_MONTHLY_USD` (US$24/month), `STRIPE_PRICE_PRO_QUARTERLY_USD` (US$59 every 90 days), `STRIPE_PRICE_PRO_MONTHLY_CAD` (CA$29/month), `STRIPE_PRICE_PRO_QUARTERLY_CAD` (CA$75 every 90 days). |

## Configured parameters

These match the Checkout Studio settings. Stripe SDK `23.0.0` uses `hosted_page`.

**File:** [src/features/billing/actions.ts](src/features/billing/actions.ts)

| Parameter | Value |
|---|---|
| ui_mode | `hosted_page` |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: true }` |
| allow_promotion_codes | `false` |
| payment_method_collection | `always` |
| submit_type | `auto` |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |

The session still sends `customer`, `client_reference_id`, `metadata`, and `subscription_data` so the webhook can attach the payment to the signed-in account. `customer_update.address` is `auto` so Stripe can save the billing address it collects. Without that, tax on an existing customer fails.

## Setup and next steps

Environment variables already match the code: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Do not add a `VITE_` prefix. The app does not use a publishable key for Checkout, because the browser only redirects to the session URL.

1. In the Stripe Dashboard, turn on Stripe Tax before anyone checks out. With tax enabled and no tax setup, Checkout returns an error. Decide whether the list price is tax-exclusive (tax added on top) or tax-inclusive, and set that tax behavior on each Price.
2. Create the four live Prices and set the env vars above on Vercel Production only. Preview stays on test keys.
3. Webhook endpoint: `https://www.rolerefine.ca/api/stripe/webhook`, events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. The handler already verifies the signature and updates the plan.
4. Production `STRIPE_SECRET_KEY` must start with `sk_live_` or `rk_live_`. Stripe’s API keys page issues `rk_live_` from **Create a secret key**. Use the **Recurring subscriptions and billing** template.

Flow: Settings → Checkout session → Stripe-hosted page → back to Settings. The plan changes only when the webhook runs.

Test card, test mode only: `4242 4242 4242 4242`, any future date, any CVC. Use a test secret key. Do not use that card with a live key.

Remaining work is the live Prices, Stripe Tax, and one live purchase followed by a refund. Support: https://support.stripe.com. Docs: https://docs.stripe.com/payments/checkout and https://docs.stripe.com/tax.
