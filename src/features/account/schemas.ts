import { z } from "zod";

/** IANA timezone id from the browser (e.g. America/Toronto). */
export const setTimezoneSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_+\-\/]+$/, "Invalid timezone"),
});
