import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const port = 3000;

/**
 * Session cookies are host-only. Use the same origin as NEXT_PUBLIC_APP_URL
 * (localhost in local .env) so the magic-link callback keeps the session.
 */
function localBaseURL(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    try {
      const url = new URL(fromEnv);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }
  return `http://127.0.0.1:${port}`;
}

const baseURL = localBaseURL();

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Smoke only (not in CI). Dev server avoids a full production build.
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
