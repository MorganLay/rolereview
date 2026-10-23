"use client";

type PostHogClient = typeof import("posthog-js").default;

let loading: Promise<PostHogClient | null> | null = null;

/**
 * Browser PostHog. Ids, enums, and counts only — never emails or user content.
 * The library is imported on first use, after the page has painted.
 */
export function loadPosthog(): Promise<PostHogClient | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return Promise.resolve(null);
  if (!loading) {
    loading = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        cookieless_mode: "always",
        person_profiles: "never",
        persistence: "memory",
        capture_pageview: true,
        capture_pageleave: true,
      });
      return posthog;
    });
  }
  return loading;
}

export function captureBrowserEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
): void {
  void loadPosthog().then((posthog) => {
    posthog?.capture(event, properties);
  });
}
