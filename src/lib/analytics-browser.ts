"use client";

import posthog from "posthog-js";

/**
 * Browser PostHog capture. Ids, enums, and counts only — never emails or user content.
 * No-op when the public key is unset or init has not run.
 */
export function captureBrowserEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.capture(event, properties);
}
