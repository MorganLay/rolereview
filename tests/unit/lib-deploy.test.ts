import { describe, expect, it } from "vitest";

import {
  deployEnvIssues,
  emailSendingEnabled,
  parseVercelEnv,
  stripeSecretIssues,
  vercelProductionIssues,
} from "@/lib/deploy";

describe("parseVercelEnv", () => {
  it("keeps Vercel's three values and drops anything else", () => {
    expect(parseVercelEnv("production")).toBe("production");
    expect(parseVercelEnv("preview")).toBe("preview");
    expect(parseVercelEnv("development")).toBe("development");
    expect(parseVercelEnv(undefined)).toBeUndefined();
    expect(parseVercelEnv("")).toBeUndefined();
    expect(parseVercelEnv("prod")).toBeUndefined();
  });
});

describe("emailSendingEnabled", () => {
  it("sends locally and on Production, and skips Preview", () => {
    expect(emailSendingEnabled(undefined)).toBe(true);
    expect(emailSendingEnabled("development")).toBe(true);
    expect(emailSendingEnabled("production")).toBe(true);
    expect(emailSendingEnabled("preview")).toBe(false);
  });
});

describe("stripeSecretIssues", () => {
  it("allows an unset key everywhere", () => {
    expect(stripeSecretIssues("production", undefined)).toEqual([]);
    expect(stripeSecretIssues("preview", undefined)).toEqual([]);
    expect(stripeSecretIssues(undefined, undefined)).toEqual([]);
  });

  it("requires a live key on Production and a test key on Preview", () => {
    expect(stripeSecretIssues("production", "sk_test_abc")).toEqual([
      "STRIPE_SECRET_KEY must start with sk_live_ on Vercel Production",
    ]);
    expect(stripeSecretIssues("production", "sk_live_abc")).toEqual([]);
    expect(stripeSecretIssues("preview", "sk_live_abc")).toEqual([
      "STRIPE_SECRET_KEY must start with sk_test_ on Vercel Preview",
    ]);
    expect(stripeSecretIssues("preview", "sk_test_abc")).toEqual([]);
    expect(stripeSecretIssues("development", "sk_live_abc")).toEqual([]);
    expect(stripeSecretIssues(undefined, "sk_test_abc")).toEqual([]);
  });
});

describe("vercelProductionIssues", () => {
  const complete = {
    SUPABASE_SECRET_KEY: "sb_secret",
    ANTHROPIC_API_KEY: "sk-ant",
    STRIPE_SECRET_KEY: "sk_live_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    STRIPE_PRICE_PRO_MONTHLY: "price_m",
    STRIPE_PRICE_PRO_QUARTERLY: "price_q",
    STRIPE_COUPON_FOUNDING: "founding",
    RESEND_API_KEY: "re_x",
    EMAIL_FROM: "RoleRefine <hello@mail.rolerefine.ca>",
    NEXT_PUBLIC_POSTHOG_KEY: "phc_x",
    NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0xsite",
    TURNSTILE_SECRET_KEY: "0xsecret",
    IP_HASH_SALT: "a".repeat(32),
  } as const;

  it("is silent off Production, even with nothing set", () => {
    expect(
      vercelProductionIssues({
        vercelEnv: "preview",
        values: {},
        appUrl: "http://localhost:3000",
        seedUserId: "seed",
      }),
    ).toEqual([]);
  });

  it("names every missing Production secret", () => {
    const issues = vercelProductionIssues({
      vercelEnv: "production",
      values: {},
      appUrl: "https://www.rolerefine.ca",
      seedUserId: undefined,
    });
    expect(issues).toContain("SUPABASE_SECRET_KEY is required on Vercel Production");
    expect(issues).toContain("STRIPE_SECRET_KEY is required on Vercel Production");
    expect(issues).toContain("RESEND_API_KEY is required on Vercel Production");
    expect(issues).toHaveLength(14);
  });

  it("passes a complete Production set", () => {
    expect(
      vercelProductionIssues({
        vercelEnv: "production",
        values: complete,
        appUrl: "https://www.rolerefine.ca",
        seedUserId: undefined,
      }),
    ).toEqual([]);
  });

  it("refuses a seed user and http on Production", () => {
    const issues = vercelProductionIssues({
      vercelEnv: "production",
      values: complete,
      appUrl: "http://www.rolerefine.ca",
      seedUserId: "11111111-1111-4111-8111-111111111111",
    });
    expect(issues).toEqual([
      "SEED_USER_ID must be unset on Vercel Production",
      "NEXT_PUBLIC_APP_URL must use https on Vercel Production",
    ]);
  });
});

describe("deployEnvIssues", () => {
  it("does not require every secret at boot, so an existing deploy keeps serving", () => {
    expect(
      deployEnvIssues({
        vercelEnv: "production",
        stripeSecretKey: undefined,
        appUrl: "https://www.rolerefine.ca",
        seedUserId: undefined,
      }),
    ).toEqual([]);
  });

  it("still rejects a test Stripe key and a seed user on Production", () => {
    expect(
      deployEnvIssues({
        vercelEnv: "production",
        stripeSecretKey: "sk_test_abc",
        appUrl: "https://www.rolerefine.ca",
        seedUserId: "seed",
      }),
    ).toEqual([
      "STRIPE_SECRET_KEY must start with sk_live_ on Vercel Production",
      "SEED_USER_ID must be unset on Vercel Production",
    ]);
  });
});
