import { z } from "zod";

export const checkoutSessionSchema = z.object({
  interval: z.enum(["MONTH", "QUARTER"]),
  previewFounding: z.boolean().optional(),
});

export const portalSessionSchema = z.object({}).strict();
