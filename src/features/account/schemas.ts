import { z } from "zod";

import { isIanaTimeZone } from "./preferences";

/** IANA timezone id from the browser (e.g. America/Toronto). */
export const timezoneSchema = z.string().trim().refine(isIanaTimeZone, "Invalid timezone");

export const setTimezoneSchema = z.object({
  timezone: timezoneSchema,
});

export const preferencesSchema = z.object({
  timezone: timezoneSchema,
  emailRemindersEnabled: z.boolean(),
  weeklyDigestEnabled: z.boolean(),
  marketingConsent: z.boolean(),
});
