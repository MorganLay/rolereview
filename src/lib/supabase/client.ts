import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (Client Components).
 * NEXT_PUBLIC_* are read here so Next can inline them at build time;
 * server code uses `env` from `@/lib/env`.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
