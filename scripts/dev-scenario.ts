/**
 * Load one progress snapshot onto SEED_USER_ID.
 * Usage: npm run dev:scenario -- job
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { applyScenario, parseScenario } from "../prisma/scenarios";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Dev snapshots are local only.");
    process.exitCode = 1;
    return;
  }

  const name = parseScenario(process.argv[2]);
  if (!name) {
    console.error("Usage: npm run dev:scenario -- new|library|job|ready|returning");
    process.exitCode = 1;
    return;
  }

  const userId = process.env.SEED_USER_ID?.trim() ?? "";
  if (!UUID.test(userId)) {
    console.error("Set SEED_USER_ID in .env to your Supabase user id.");
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    console.error("Set DIRECT_URL in .env.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      console.error("No User row for SEED_USER_ID. Sign in once, then run this again.");
      process.exitCode = 1;
      return;
    }

    const plan = await applyScenario(prisma, userId, name);
    console.log(
      `Loaded ${name} for ${userId}: library ${plan.library}, hunt ${plan.hunt}, onboarding ${plan.onboarding}.`,
    );
  } catch (error) {
    const code =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "UNKNOWN";
    console.error(`Snapshot failed (${code}).`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
