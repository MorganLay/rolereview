import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/** Service client for auth.admin. Null until SUPABASE_SECRET_KEY is set. */
export function createAdminClient(): SupabaseClient | null {
  const key = env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
