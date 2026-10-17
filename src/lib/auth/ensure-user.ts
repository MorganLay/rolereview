import "server-only";

import { nanoid } from "nanoid";

import type { Plan, UserRole } from "@/generated/prisma/client";
import {
  attributionFromCookie,
  type UserCreateAttribution,
} from "@/lib/auth/attribution";
import { db } from "@/lib/db";

export type SessionUser = {
  id: string;
  email: string;
  plan: Plan;
  role: UserRole;
};

const REFERRAL_CODE_ATTEMPTS = 5;

/**
 * Find or create the Prisma User for a Supabase auth user.
 * Attribution and Referral rows are written only on create.
 */
export async function ensureUserRow(
  authUser: { id: string; email: string | undefined },
  cookieValue: string | undefined,
): Promise<SessionUser | null> {
  const email = authUser.email?.trim();
  if (!email) return null;

  const existing = await db.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, plan: true, role: true },
  });

  if (existing) {
    if (existing.email !== email) {
      const updated = await db.user.update({
        where: { id: existing.id },
        data: { email },
        select: { id: true, email: true, plan: true, role: true },
      });
      return updated;
    }
    return existing;
  }

  const attribution = attributionFromCookie(cookieValue);
  return createUserWithAttribution(authUser.id, email, attribution);
}

async function createUserWithAttribution(
  id: string,
  email: string,
  attribution: UserCreateAttribution,
): Promise<SessionUser> {
  let referrerId: string | null = null;
  if (attribution.refCode) {
    const referrer = await db.user.findFirst({
      where: { referralCode: attribution.refCode },
      select: { id: true },
    });
    if (referrer && referrer.id !== id) {
      referrerId = referrer.id;
    }
  }

  for (let attempt = 0; attempt < REFERRAL_CODE_ATTEMPTS; attempt++) {
    const referralCode = nanoid(8);
    try {
      const created = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id,
            email,
            referralCode,
            signupSource: attribution.signupSource,
            signupReferrer: attribution.signupReferrer,
            utmSource: attribution.utmSource,
            utmMedium: attribution.utmMedium,
            utmCampaign: attribution.utmCampaign,
          },
          select: { id: true, email: true, plan: true, role: true },
        });

        if (referrerId) {
          await tx.referral.create({
            data: {
              referrerId,
              referredUserId: user.id,
            },
          });
        }

        return user;
      });
      return created;
    } catch (error) {
      const raced = await db.user.findUnique({
        where: { id },
        select: { id: true, email: true, plan: true, role: true },
      });
      if (raced) return raced;

      if (!isUniqueViolation(error)) throw error;

      // Same email already linked to a different auth id (e.g. auth user
      // recreated) — do not silently attach the wrong row.
      const byEmail = await db.user.findUnique({
        where: { email },
        select: { id: true, email: true, plan: true, role: true },
      });
      if (byEmail?.id === id) return byEmail;
      if (byEmail) throw error;

      // Referral-code collision — retry with a new code.
      if (attempt < REFERRAL_CODE_ATTEMPTS - 1) continue;
      throw error;
    }
  }

  throw new Error("Could not allocate a unique referral code");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}
