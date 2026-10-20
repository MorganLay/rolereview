/**
 * Dev-only seed. Replaces library rows and profile header fields for SEED_USER_ID.
 * Email stays the sign-in address. Reads env here because this script runs
 * outside Next and cannot import `src/lib/env.ts` (`server-only`).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";

import { SEED_LIBRARY } from "./library-seed";

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

    const bullets = SEED_LIBRARY.entries.reduce(
      (total, entry) => total + entry.bullets.length,
      0,
    );
    console.log(
      `Seeded library for ${userId}: ${SEED_LIBRARY.entries.length} entries, ${SEED_LIBRARY.skills.length} skills, ${bullets} bullets. Replaced ${replacedEntries} entries and ${replacedSkills} skills.`,
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

/** One retry: the pooler sometimes fails to open an interactive transaction (P2028). */
async function replaceLibrary(prisma: PrismaClient, userId: string) {
  try {
    return await writeLibrary(prisma, userId);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2028"
    ) {
      return writeLibrary(prisma, userId);
    }
    throw error;
  }
}

async function writeLibrary(prisma: PrismaClient, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const removedEntries = await tx.entry.deleteMany({ where: { userId } });
      const removedSkills = await tx.skill.deleteMany({ where: { userId } });

      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: SEED_LIBRARY.profile.fullName,
          headline: SEED_LIBRARY.profile.headline,
          phone: SEED_LIBRARY.profile.phone,
          location: SEED_LIBRARY.profile.location,
          summary: SEED_LIBRARY.profile.summary,
          links: [...SEED_LIBRARY.profile.links],
        },
      });

      const sortByKind = new Map<string, number>();
      for (const entry of SEED_LIBRARY.entries) {
        const sortOrder = sortByKind.get(entry.kind) ?? 0;
        sortByKind.set(entry.kind, sortOrder + 1);
        await tx.entry.create({
          data: {
            userId,
            kind: entry.kind,
            title: entry.title,
            organization: entry.organization,
            location: entry.location,
            startDate: entry.startDate,
            endDate: entry.isCurrent ? null : entry.endDate,
            isCurrent: entry.isCurrent,
            url: entry.url,
            sortOrder,
            bullets: {
              create: entry.bullets.map((bullet, index) => ({
                userId,
                text: bullet.text,
                tags: [],
                sortOrder: index,
              })),
            },
          },
        });
      }

      for (const [index, skill] of SEED_LIBRARY.skills.entries()) {
        await tx.skill.create({
          data: {
            userId,
            name: skill.name,
            nameKey: skill.name.trim().toLowerCase(),
            category: skill.category,
            sortOrder: index,
          },
        });
      }

      return [removedEntries.count, removedSkills.count] as const;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}
