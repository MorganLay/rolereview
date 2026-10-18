"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

let initialized = false;

/**
 * Cookieless PostHog (docs/03-ARCHITECTURE.md). No-op when the public key is unset.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || initialized) return;
    initialized = true;

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      cookieless_mode: "always",
      person_profiles: "never",
      persistence: "memory",
      capture_pageview: true,
      capture_pageleave: true,
    });
  }, []);

  return children;
}
