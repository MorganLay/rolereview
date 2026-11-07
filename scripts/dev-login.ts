/**
 * Print a local magic-link URL for the seed account. No email is sent.
 * Usage: npm run dev:login
 *        npm run dev:login -- you@example.com
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { normalizeDevEmail, parseDevLoginArgs } from "../src/features/dev/login-args";
import { PrismaClient } from "../src/generated/prisma/client";

const LINK_TYPES = new Set(["signup", "magiclink", "email"]);
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Dev sign-in is local only.");
    process.exitCode = 1;
    return;
  }

  const parsed = parseDevLoginArgs(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(parsed.error);
    process.exitCode = 1;
    return;
  }

  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secret = readEnv("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !secret) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.");
    process.exitCode = 1;
    return;
  }

  const email = await resolveEmail(parsed.email);
  if (!email) {
    process.exitCode = 1;
    return;
  }

  const redirectTo = new URL("/auth/callback", parsed.origin);
  redirectTo.searchParams.set("next", parsed.next);

  const admin = createClient(supabaseUrl, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: redirectTo.toString() },
  });

  const tokenHash = data.properties?.hashed_token;
  const type = data.properties?.verification_type;
  const userId = data.user?.id;
  if (error || !tokenHash || !type || !LINK_TYPES.has(type) || !userId) {
    console.error(`Could not create a sign-in link (${error?.code ?? "generate"}).`);
    process.exitCode = 1;
    return;
  }

  const signInUrl = new URL("/auth/callback", parsed.origin);
  signInUrl.searchParams.set("token_hash", tokenHash);
  signInUrl.searchParams.set("type", type);
  signInUrl.searchParams.set("next", parsed.next);

  const seedUserId = process.env.SEED_USER_ID?.trim() ?? "";
  console.log(`Sign in: ${signInUrl.toString()}`);
  console.log(`Auth user id: ${userId}`);
  if (seedUserId !== userId) {
    console.log("Set SEED_USER_ID to that id and restart npm run dev. Then open /dev.");
  }
}

async function resolveEmail(given: string | undefined): Promise<string | null> {
  if (given) {
    const email = normalizeDevEmail(given);
    if (!email) {
      console.error("That email address is not usable.");
      return null;
    }
    return email;
  }

  const userId = process.env.SEED_USER_ID?.trim() ?? "";
  if (!UUID.test(userId)) {
    console.error("Pass an email, or set SEED_USER_ID and sign in once first.");
    return null;
  }

  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    console.error("Set DIRECT_URL in .env, or pass an email.");
    return null;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      console.error("No User row for SEED_USER_ID. Pass the sign-in email instead.");
      return null;
    }
    const email = normalizeDevEmail(user.email);
    if (!email) {
      console.error("The seed account email is not usable.");
      return null;
    }
    return email;
  } finally {
    await prisma.$disconnect();
  }
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value.includes("<") || value.includes("...")) return undefined;
  return value;
}

void main();
