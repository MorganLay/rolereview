/**
 * Vercel Production vs Preview rules.
 * docs/03-ARCHITECTURE.md → Environments & deployment.
 * Vercel sets VERCEL_ENV; it is not a secret and is unset locally.
 */

export const VERCEL_ENVS = ["production", "preview", "development"] as const;
export type VercelEnv = (typeof VERCEL_ENVS)[number];

export const VERCEL_PRODUCTION_REQUIRED = [
  "SUPABASE_SECRET_KEY",
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_QUARTERLY",
  "STRIPE_COUPON_FOUNDING",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "IP_HASH_SALT",
] as const;

export function parseVercelEnv(value: string | undefined): VercelEnv | undefined {
  if (value === "production" || value === "preview" || value === "development") {
    return value;
  }
  return undefined;
}

/** PR previews must not send mail (welcome or magic link). */
export function emailSendingEnabled(vercelEnv: string | undefined): boolean {
  return vercelEnv !== "preview";
}

/**
 * Live keys only on Vercel Production. Test keys only on Preview when set.
 * Unset is allowed: checkout and the webhook already no-op.
 */
export function stripeSecretIssues(
  vercelEnv: string | undefined,
  secretKey: string | undefined,
): string[] {
  if (!secretKey) return [];
  if (vercelEnv === "production" && !secretKey.startsWith("sk_live_")) {
    return ["STRIPE_SECRET_KEY must start with sk_live_ on Vercel Production"];
  }
  if (vercelEnv === "preview" && !secretKey.startsWith("sk_test_")) {
    return ["STRIPE_SECRET_KEY must start with sk_test_ on Vercel Preview"];
  }
  return [];
}

export function vercelProductionIssues(input: {
  vercelEnv: string | undefined;
  values: Partial<Record<(typeof VERCEL_PRODUCTION_REQUIRED)[number], string | undefined>>;
  appUrl: string | undefined;
  seedUserId: string | undefined;
}): string[] {
  if (input.vercelEnv !== "production") return [];
  const issues: string[] = [];
  for (const key of VERCEL_PRODUCTION_REQUIRED) {
    if (!input.values[key]) {
      issues.push(`${key} is required on Vercel Production`);
    }
  }
  if (input.seedUserId) {
    issues.push("SEED_USER_ID must be unset on Vercel Production");
  }
  if (input.appUrl) {
    try {
      const url = new URL(input.appUrl);
      if (url.protocol !== "https:") {
        issues.push("NEXT_PUBLIC_APP_URL must use https on Vercel Production");
      }
    } catch {
      issues.push("NEXT_PUBLIC_APP_URL must be a URL on Vercel Production");
    }
  }
  return issues;
}

/** Boot-time checks that are safe on an existing Production deploy. */
export function deployEnvIssues(input: {
  vercelEnv: string | undefined;
  stripeSecretKey: string | undefined;
  appUrl: string | undefined;
  seedUserId: string | undefined;
}): string[] {
  const issues = stripeSecretIssues(input.vercelEnv, input.stripeSecretKey);
  if (input.vercelEnv !== "production") return issues;
  if (input.seedUserId) {
    issues.push("SEED_USER_ID must be unset on Vercel Production");
  }
  if (input.appUrl) {
    try {
      const url = new URL(input.appUrl);
      if (url.protocol !== "https:") {
        issues.push("NEXT_PUBLIC_APP_URL must use https on Vercel Production");
      }
    } catch {
      issues.push("NEXT_PUBLIC_APP_URL must be a URL on Vercel Production");
    }
  }
  return issues;
}
