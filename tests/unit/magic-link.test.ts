import { createElement } from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import {
  magicLinkBlocked,
  magicLinkOriginAllowed,
  magicLinkRecipientKey,
  magicLinkSignInUrl,
  requestMagicLinkSchema,
} from "@/features/auth/magic-link";
import { strings } from "@/copy/strings";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";

describe("magicLinkOriginAllowed", () => {
  const app = "https://rolerefine.example";

  it("allows the app origin and localhost outside production", () => {
    expect(magicLinkOriginAllowed(app, app, "production")).toBe(true);
    expect(magicLinkOriginAllowed("http://localhost:3000", app, "development")).toBe(true);
    expect(magicLinkOriginAllowed("http://127.0.0.1:4000", app, "test")).toBe(true);
  });

  it("rejects other hosts, and localhost in production", () => {
    expect(magicLinkOriginAllowed("https://evil.example", app, "production")).toBe(false);
    expect(magicLinkOriginAllowed("http://localhost:3000", app, "production")).toBe(false);
    expect(magicLinkOriginAllowed("javascript:alert(1)", app, "development")).toBe(false);
    expect(magicLinkOriginAllowed("not a url", app, "development")).toBe(false);
  });
});

describe("magicLinkRecipientKey", () => {
  it("hashes the address and changes with the salt", () => {
    const email = "person@example.com";
    const key = magicLinkRecipientKey(email, "salt");
    expect(key).toHaveLength(64);
    expect(key).not.toContain("person");
    expect(magicLinkRecipientKey(email, "salt")).toBe(key);
    expect(magicLinkRecipientKey(email, "other")).not.toBe(key);
  });
});

describe("magicLinkBlocked", () => {
  it("blocks at five sends in the window", () => {
    expect(magicLinkBlocked(4)).toBe(false);
    expect(magicLinkBlocked(5)).toBe(true);
  });
});

describe("requestMagicLinkSchema", () => {
  it("normalizes the address", () => {
    const parsed = requestMagicLinkSchema.safeParse({
      email: "  Person@Example.com ",
      next: "/dashboard",
      origin: "http://localhost:3000",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("person@example.com");
  });

  it("rejects an address that is not an email", () => {
    const parsed = requestMagicLinkSchema.safeParse({
      email: "not-an-email",
      origin: "http://localhost:3000",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("magicLinkSignInUrl", () => {
  it("points at the callback with the token and next path", () => {
    const url = new URL(
      magicLinkSignInUrl({
        origin: "http://localhost:3000",
        tokenHash: "hash",
        type: "signup",
        next: "/library/import",
      }),
    );
    expect(url.origin).toBe("http://localhost:3000");
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("token_hash")).toBe("hash");
    expect(url.searchParams.get("type")).toBe("signup");
    expect(url.searchParams.get("next")).toBe("/library/import");
  });
});

describe("MagicLinkEmail", () => {
  it("includes the sign-in link, preferences, and location", async () => {
    const html = await render(
      createElement(MagicLinkEmail, {
        signInUrl: "http://localhost:3000/auth/callback?token_hash=hash",
        preferencesUrl: "http://localhost:3000/settings?tab=preferences",
        mailingAddress: null,
      }),
    );
    expect(html).toContain(strings.email.magicLink.cta);
    expect(html).toContain("token_hash=hash");
    expect(html).toContain(strings.email.magicLink.preferences);
    expect(html).toContain(strings.email.magicLink.location);
  });
});
