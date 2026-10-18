import "server-only";

import { env } from "@/lib/env";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Missing secret or empty token → false (bots rejected).
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret || !token?.trim()) return false;

  const body = new URLSearchParams({
    secret,
    response: token.trim(),
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as TurnstileResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
