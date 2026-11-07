/**
 * Dev-only seed. Replaces the SEED_USER_ID library, jobs, and tracking rows.
 * Email stays the sign-in address. Reads env here because this script runs
 * outside Next and cannot import `src/lib/env.ts` (`server-only`).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";

import { replaceHunt } from "./hunt-seed";
import { SEED_LIBRARY } from "./library-seed";
import { replaceLibrary } from "./library-write";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Seed is dev only.");
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
      console.error(
        "No User row for SEED_USER_ID. Sign in once, then run npm run db:seed again.",
      );
      process.exitCode = 1;
      return;
    }

    const [replacedEntries, replacedSkills] = await replaceLibrary(prisma, userId);
    const hunt = await replaceHunt(prisma, userId);

    const bullets = SEED_LIBRARY.entries.reduce(
      (total, entry) => total + entry.bullets.length,
      0,
    );
    console.log(
      `Seeded library for ${userId}: ${SEED_LIBRARY.entries.length} entries, ${SEED_LIBRARY.skills.length} skills, ${bullets} bullets. Replaced ${replacedEntries} entries and ${replacedSkills} skills.`,
    );
    console.log(
      `Seeded hunt for ${userId}: ${hunt.jobs} jobs, ${hunt.contacts} contacts, ${hunt.interviews} interviews, ${hunt.reminders} reminders, ${hunt.resumes} resumes.`,
    );
  } catch (error) {
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : "UNKNOWN";
    console.error(`Seed failed (${code}).`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
