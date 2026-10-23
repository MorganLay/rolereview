import { createClient } from "@supabase/supabase-js";

import { envValue } from "./env";

const LINK_TYPES = new Set(["signup", "magiclink", "email"]);

export type E2ESession = {
  userId: string;
  email: string;
  signInUrl: string;
};

function adminClient() {
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
  const key = envValue("SUPABASE_SECRET_KEY");
  if (!url || !key) {
    throw new Error("Happy path needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function signInUrl(origin: string, tokenHash: string, type: string, next: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("next", next);
  return url.toString();
}

/** Admin generateLink — no Resend. Lands on the same callback a magic-link email uses. */
export async function createE2ESession(
  origin: string,
  next = "/library/import",
): Promise<E2ESession> {
  const email = `e2e.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const redirectTo = new URL("/auth/callback", origin);
  redirectTo.searchParams.set("next", next);

  const { data, error } = await adminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: redirectTo.toString() },
  });

  const tokenHash = data.properties?.hashed_token;
  const type = data.properties?.verification_type;
  const userId = data.user?.id;
  if (error || !tokenHash || !type || !LINK_TYPES.has(type) || !userId) {
    throw new Error(`Could not create an e2e sign-in link (${error?.code ?? "generate"}).`);
  }

  return {
    userId,
    email,
    signInUrl: signInUrl(origin, tokenHash, type, next),
  };
}
