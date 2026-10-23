"use client";

import { useEffect } from "react";

import { loadPosthog } from "@/lib/analytics-browser";

/**
 * Cookieless PostHog (docs/03-ARCHITECTURE.md). No-op when the public key is unset.
 * The library loads on the first click or keypress, or after 8 seconds,
 * so it stays out of the first paint.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let started = false;
    let timer = 0;
    const start = () => {
      if (started) return;
      started = true;
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      void loadPosthog();
    };
    timer = window.setTimeout(start, 8000);
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      started = true;
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, []);

  return children;
}
