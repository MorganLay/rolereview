import { createHash } from "node:crypto";

import { z } from "zod";

export const MAGIC_LINK_TEMPLATE = "magic-link";
export const MAGIC_LINK_LIMIT = 5;
export const MAGIC_LINK_WINDOW_MS = 60 * 60 * 1000;

const emailField = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

export const requestMagicLinkSchema = z.object({
  email: emailField,
  next: z.string().max(2000).optional(),
  origin: z.string().trim().url().max(500),
});

export function magicLinkBlocked(count: number, limit = MAGIC_LINK_LIMIT): boolean {
  return count >= limit;
}

/** Hash the address so EmailLog never stores it. */
export function magicLinkRecipientKey(email: string, salt: string): string {
  return createHash("sha256").update(`magic-link:${salt}:${email}`).digest("hex");
}

/**
 * The browser origin must be the app, or localhost outside production.
 * Rejects anything that is not an http(s) origin.
 */
export function magicLinkOriginAllowed(
  origin: string,
  appUrl: string,
  nodeEnv: string,
): boolean {
  let requestOrigin: URL;
  let app: URL;
  try {
    requestOrigin = new URL(origin);
    app = new URL(appUrl);
  } catch {
    return false;
  }
  if (requestOrigin.origin === app.origin) return true;
  if (nodeEnv === "production") return false;
  if (requestOrigin.protocol !== "http:") return false;
  return requestOrigin.hostname === "localhost" || requestOrigin.hostname === "127.0.0.1";
}

export function magicLinkRedirectUrl(origin: string, next: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  return url.toString();
}

export function magicLinkSignInUrl(input: {
  origin: string;
  tokenHash: string;
  type: string;
  next: string;
}): string {
  const url = new URL("/auth/callback", input.origin);
  url.searchParams.set("token_hash", input.tokenHash);
  url.searchParams.set("type", input.type);
  url.searchParams.set("next", input.next);
  return url.toString();
}
