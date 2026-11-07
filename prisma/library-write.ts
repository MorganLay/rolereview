/**
 * Dev-only library replace and clear for SEED_USER_ID.
 * Email stays the sign-in address. Profile header fields are replaced.
 */

import { Prisma, PrismaClient } from "../src/generated/prisma/client";

import { SEED_LIBRARY } from "./library-seed";

export async function replaceLibrary(prisma: PrismaClient, userId: string) {
  return withPoolerRetry(() => writeLibrary(prisma, userId));
}

/** Empty library: no entries, skills, or target profiles. Profile header fields clear. */
export async function clearLibrary(prisma: PrismaClient, userId: string) {
  return withPoolerRetry(() => eraseLibrary(prisma, userId));
}

/** One retry: the pooler sometimes fails to open an interactive transaction (P2028). */
async function withPoolerRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028") {
      return run();
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

async function eraseLibrary(prisma: PrismaClient, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.bullet.deleteMany({ where: { userId } });
      await tx.entry.deleteMany({ where: { userId } });
      await tx.skill.deleteMany({ where: { userId } });
      await tx.targetProfile.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: null,
          headline: null,
          phone: null,
          location: null,
          summary: null,
          links: [],
        },
      });
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}
