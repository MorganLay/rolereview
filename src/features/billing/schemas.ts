import { z } from "zod";

export const planCurrencySchema = z.object({
  currency: z.enum(["USD", "CAD"]),
});

export const checkoutSessionSchema = z.object({
  interval: z.enum(["MONTH", "QUARTER"]),
  currency: z.enum(["USD", "CAD"]),
  /** Accepted and ignored. Checkout does not apply the founding coupon. */
  previewFounding: z.boolean().optional(),
});

export const portalSessionSchema = z.object({}).strict();
