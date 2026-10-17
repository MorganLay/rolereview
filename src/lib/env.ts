import "server-only";

import { z } from "zod";

/**
 * Validated environment. Import `env` everywhere — never read `process.env` in app code.
 * Secrets for later phases stay optional so local work (and T0.3) doesn't need fake keys.
 * Placeholder values from `.env.example` (containing `<...>`) are treated as unset.
 */
function readOptional(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.includes("<")) return undefined;
  return value;
}

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  SUPABASE_SECRET_KEY: z.string().min(1).optional(),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1).optional(),
  STRIPE_PRICE_PRO_QUARTERLY: z.string().min(1).optional(),
  STRIPE_COUPON_FOUNDING: z.string().min(1).optional(),

  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  MAILING_ADDRESS: z.string().min(1).optional(),

  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  IP_HASH_SALT: z.string().min(1).optional(),

  CRON_SECRET: z.string().min(1).optional(),

  SEED_USER_ID: z.string().min(1).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
});

const schema = serverSchema.merge(clientSchema);

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SUPABASE_SECRET_KEY: readOptional("SUPABASE_SECRET_KEY"),
    ANTHROPIC_API_KEY: readOptional("ANTHROPIC_API_KEY"),
    STRIPE_SECRET_KEY: readOptional("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: readOptional("STRIPE_WEBHOOK_SECRET"),
    STRIPE_PRICE_PRO_MONTHLY: readOptional("STRIPE_PRICE_PRO_MONTHLY"),
    STRIPE_PRICE_PRO_QUARTERLY: readOptional("STRIPE_PRICE_PRO_QUARTERLY"),
    STRIPE_COUPON_FOUNDING: readOptional("STRIPE_COUPON_FOUNDING"),
    RESEND_API_KEY: readOptional("RESEND_API_KEY"),
    EMAIL_FROM: readOptional("EMAIL_FROM"),
    MAILING_ADDRESS: readOptional("MAILING_ADDRESS"),
    TURNSTILE_SECRET_KEY: readOptional("TURNSTILE_SECRET_KEY"),
    IP_HASH_SALT: readOptional("IP_HASH_SALT"),
    CRON_SECRET: readOptional("CRON_SECRET"),
    SEED_USER_ID: readOptional("SEED_USER_ID"),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: readOptional("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: readOptional(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
    NEXT_PUBLIC_POSTHOG_KEY: readOptional("NEXT_PUBLIC_POSTHOG_KEY"),
    NEXT_PUBLIC_POSTHOG_HOST: readOptional("NEXT_PUBLIC_POSTHOG_HOST"),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: readOptional("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }

  return parsed.data;
}

export const env = loadEnv();
