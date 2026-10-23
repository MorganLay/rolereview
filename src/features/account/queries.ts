import "server-only";

import { db } from "@/lib/db";

import type { AccountPreferences } from "./preferences";

export type { AccountPreferences };

export async function getPreferences(userId: string): Promise<AccountPreferences | null> {
  const row = await db.user.findFirst({
    where: { id: userId },
    select: {
      timezone: true,
      emailRemindersEnabled: true,
      weeklyDigestEnabled: true,
      marketingConsentAt: true,
    },
  });
  if (!row) return null;
  return {
    timezone: row.timezone,
    emailRemindersEnabled: row.emailRemindersEnabled,
    weeklyDigestEnabled: row.weeklyDigestEnabled,
    marketingConsent: row.marketingConsentAt !== null,
  };
}
