import "server-only";

import { db } from "@/lib/db";

/** Records that the four getting-started steps are done. A second call changes nothing. */
export async function completeOnboarding(userId: string): Promise<boolean> {
  const result = await db.user.updateMany({
    where: { id: userId, onboardingCompletedAt: null },
    data: { onboardingCompletedAt: new Date() },
  });
  return result.count === 1;
}
