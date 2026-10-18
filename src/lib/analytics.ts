import "server-only";

import { PostHog } from "posthog-node";

import { env } from "@/lib/env";

/**
 * Server-side PostHog capture. Ids/enums/counts only — never emails or user content.
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const client = new PostHog(key, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  try {
    client.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        $process_person_profile: false,
      },
    });
    await client.shutdown();
  } catch {
    // Analytics must not break product flows.
  }
}
