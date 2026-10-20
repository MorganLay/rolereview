import "server-only";

import { quotaSnapshot } from "@/features/billing/quota";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type ImportPageData = {
  /** True while `onboardingCompletedAt` is still null. */
  onboarding: boolean;
  libraryHasContent: boolean;
  importsLeft: number;
  email: string;
};

/** What the import page needs before the client state machine starts. */
export async function getImportPage(
  user: Pick<SessionUser, "id" | "plan" | "email">,
): Promise<ImportPageData | null> {
  const row = await db.user.findFirst({
    where: { id: user.id },
    select: {
      onboardingCompletedAt: true,
      _count: { select: { entries: true, skills: true } },
    },
  });
  if (!row) return null;

  const quota = await quotaSnapshot(user, "IMPORT");
  return {
    onboarding: row.onboardingCompletedAt === null,
    libraryHasContent: row._count.entries > 0 || row._count.skills > 0,
    importsLeft: quota.remaining,
    email: user.email,
  };
}
