import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import { envValue } from "./env";

/** Drop the Prisma row (cascade) then the auth user. Safe to call if either is already gone. */
export async function deleteE2EUser(userId: string): Promise<void> {
  const direct = envValue("DIRECT_URL");
  if (direct) {
    const client = new Client({ connectionString: direct });
    await client.connect();
    try {
      await client.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    } finally {
      await client.end();
    }
  }

  const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
  const key = envValue("SUPABASE_SECRET_KEY");
  if (!url || !key) return;
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await admin.auth.admin.deleteUser(userId);
}
