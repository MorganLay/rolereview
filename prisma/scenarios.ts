/**
 * Named progress snapshots for the seed account.
 * `npm run db:seed` does not call this. It still leaves onboarding as it is.
 */

import type { PrismaClient } from "../src/generated/prisma/client";

import { clearHunt, replaceHunt, seedProgressJob } from "./hunt-seed";
import { clearLibrary, replaceLibrary } from "./library-write";

export const SCENARIO_NAMES = ["new", "library", "job", "ready", "returning"] as const;

export type ScenarioName = (typeof SCENARIO_NAMES)[number];

export type ScenarioPlan = {
  library: "empty" | "seed";
  hunt: "empty" | "saved-job" | "ready-resume" | "full";
  onboarding: "open" | "closed";
};

/** Far enough in the past that the dashboard does not treat it as just finished. */
export const ONBOARDING_CLOSED_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function parseScenario(value: unknown): ScenarioName | null {
  if (typeof value !== "string") return null;
  for (const name of SCENARIO_NAMES) {
    if (name === value) return name;
  }
  return null;
}

export function scenarioPlan(name: ScenarioName): ScenarioPlan {
  switch (name) {
    case "new":
      return { library: "empty", hunt: "empty", onboarding: "open" };
    case "library":
      return { library: "seed", hunt: "empty", onboarding: "open" };
    case "job":
      return { library: "seed", hunt: "saved-job", onboarding: "open" };
    case "ready":
      return { library: "seed", hunt: "ready-resume", onboarding: "open" };
    case "returning":
      return { library: "seed", hunt: "full", onboarding: "closed" };
  }
}

export function onboardingStamp(mode: ScenarioPlan["onboarding"], now: Date): Date | null {
  if (mode === "open") return null;
  return new Date(now.getTime() - ONBOARDING_CLOSED_AGE_MS);
}

export async function applyScenario(
  prisma: PrismaClient,
  userId: string,
  name: ScenarioName,
  now = new Date(),
): Promise<ScenarioPlan> {
  const plan = scenarioPlan(name);
  await prisma.targetProfile.deleteMany({ where: { userId } });

  if (plan.library === "empty") {
    await clearHunt(prisma, userId);
    await clearLibrary(prisma, userId);
  } else {
    await replaceLibrary(prisma, userId);
    if (plan.hunt === "full") {
      await replaceHunt(prisma, userId);
    } else if (plan.hunt === "saved-job") {
      await clearHunt(prisma, userId);
      await seedProgressJob(prisma, userId, { resume: false });
    } else if (plan.hunt === "ready-resume") {
      await clearHunt(prisma, userId);
      await seedProgressJob(prisma, userId, { resume: true });
    } else {
      await clearHunt(prisma, userId);
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: onboardingStamp(plan.onboarding, now) },
  });

  return plan;
}
