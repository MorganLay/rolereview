"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, ok, type ActionResult } from "@/lib/result";
import { applyScenario, type ScenarioName } from "../../../prisma/scenarios";

import { devSnapshotsOpen } from "./access";
import { loadScenarioSchema } from "./schemas";

const REFRESH_PATHS = ["/dev", "/dashboard", "/library", "/library/import", "/jobs", "/contacts", "/insights"] as const;

/** Replace the seed account with one progress snapshot. Other accounts get NOT_FOUND. */
export async function loadScenario(
  input: unknown,
): Promise<ActionResult<{ scenario: ScenarioName }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (
    !devSnapshotsOpen({
      nodeEnv: env.NODE_ENV,
      seedUserId: env.SEED_USER_ID,
      userId: user.id,
    })
  ) {
    return fail("NOT_FOUND");
  }

  const parsed = loadScenarioSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");

  try {
    await applyScenario(db, user.id, parsed.data.scenario);
  } catch (error) {
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN";
    console.error("dev scenario failed", { code });
    return fail("INTERNAL");
  }

  for (const path of REFRESH_PATHS) {
    revalidatePath(path);
  }
  return ok({ scenario: parsed.data.scenario });
}
