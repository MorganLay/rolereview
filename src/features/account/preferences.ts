import { strings } from "@/copy/strings";

export const MARKETING_CONSENT_TEXT = strings.settings.preferences.marketing;

export type AccountPreferences = {
  timezone: string;
  emailRemindersEnabled: boolean;
  weeklyDigestEnabled: boolean;
  marketingConsent: boolean;
};

const TIME_ZONE_PATTERN = /^[A-Za-z0-9_+\-/]+$/;

export function isIanaTimeZone(value: string): boolean {
  if (!value || value.length > 100 || !TIME_ZONE_PATTERN.test(value)) return false;
  try {
    Intl.DateTimeFormat("en-CA", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** IANA zones, with the account's current zone kept even if the runtime list omits it. */
export function timeZoneChoices(current: string): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  if (zones.includes(current)) return zones;
  return [current, ...zones];
}

/**
 * Ticking stores the timestamp and the exact wording. A later save that stays
 * ticked keeps the original timestamp when the wording is unchanged.
 * Unticking clears both fields.
 */
export function nextMarketingConsent(input: {
  requested: boolean;
  existingAt: Date | null;
  existingText: string | null;
  now: Date;
  text: string;
}): { marketingConsentAt: Date | null; marketingConsentText: string | null } {
  if (!input.requested) {
    return { marketingConsentAt: null, marketingConsentText: null };
  }
  if (input.existingAt && input.existingText === input.text) {
    return { marketingConsentAt: input.existingAt, marketingConsentText: input.text };
  }
  return { marketingConsentAt: input.now, marketingConsentText: input.text };
}
