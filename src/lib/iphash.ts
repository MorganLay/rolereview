import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Daily IP hash for anonymous free-tool limits.
 * docs/03-ARCHITECTURE.md → Free tools: sha256(ip + IP_HASH_SALT + yyyy-mm-dd).
 */

export function utcDayStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function hashIp(ip: string, salt: string, day: string): string {
  return createHash("sha256").update(`${ip}${salt}${day}`).digest("hex");
}

/** Null when the salt is unset so callers can fail closed. */
export function hashClientIp(ip: string, now: Date = new Date()): string | null {
  const salt = env.IP_HASH_SALT;
  if (!salt) return null;
  return hashIp(ip, salt, utcDayStamp(now));
}

export function clientIpFromHeaders(headerStore: Headers): string | null {
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = headerStore.get("x-real-ip")?.trim();
  return real || null;
}

/** Production fails closed with no client IP. Local uses loopback so forms still work. */
export function clientIpForLimit(headerStore: Headers, nodeEnv: string): string | null {
  return clientIpFromHeaders(headerStore) ?? (nodeEnv === "production" ? null : "127.0.0.1");
}
