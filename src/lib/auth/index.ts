import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  ensureUserRow,
  type SessionUser,
} from "@/lib/auth/ensure-user";
import { ATTRIBUTION_COOKIE } from "@/lib/supabase/attribution";
import { createClient } from "@/lib/supabase/server";

export type { SessionUser };

/**
 * Security boundary for pages, layouts, and route handlers.
 * Upserts the Prisma User on first call (attribution + optional Referral).
 * Signed-out → redirect to /sign-in.
 *
 * Server actions that need `fail("UNAUTHENTICATED")` should use
 * `requireUserForAction()` instead.
 */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const user = await loadSessionUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
});

/**
 * Same as requireUser, but returns null when signed out so actions can
 * `return fail("UNAUTHENTICATED")`.
 */
export const requireUserForAction = cache(
  async (): Promise<SessionUser | null> => loadSessionUser(),
);

/** requireUser + role ADMIN; everyone else gets 404. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    notFound();
  }
  return user;
}

async function loadSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const cookieStore = await cookies();
  const attribution = cookieStore.get(ATTRIBUTION_COOKIE)?.value;

  return ensureUserRow(
    { id: authUser.id, email: authUser.email },
    attribution,
  );
}
