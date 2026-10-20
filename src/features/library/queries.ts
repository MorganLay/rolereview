import "server-only";

import type { EntryKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import { ENTRY_KINDS, ProfileLinks } from "./schemas";
import type { Library, LibraryProfile } from "./types";

/** Screen order for library sections. Sort order applies inside each kind. */
const ENTRY_KIND_ORDER: readonly EntryKind[] = ENTRY_KINDS;

export type { Library, LibraryProfile };

/**
 * The signed-in user's library. Profile links are parsed on read.
 * Entries are grouped into sections on the library page. Skills render in a later task.
 */
export async function getLibrary(userId: string): Promise<Library | null> {
  const user = await db.user.findFirst({
    where: { id: userId },
    select: {
      email: true,
      fullName: true,
      headline: true,
      phone: true,
      location: true,
      links: true,
      summary: true,
      entries: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          kind: true,
          title: true,
          organization: true,
          location: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
          url: true,
          sortOrder: true,
          bullets: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, text: true, sortOrder: true },
          },
        },
      },
      skills: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, category: true, sortOrder: true },
      },
    },
  });

  if (!user) return null;

  const links = ProfileLinks.parse(user.links);
  const entries = [...user.entries].sort((a, b) => {
    const kindDelta =
      ENTRY_KIND_ORDER.indexOf(a.kind) - ENTRY_KIND_ORDER.indexOf(b.kind);
    if (kindDelta !== 0) return kindDelta;
    return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
  });

  return {
    profile: {
      fullName: user.fullName,
      headline: user.headline,
      email: user.email,
      phone: user.phone,
      location: user.location,
      links,
      summary: user.summary,
    },
    entries,
    skills: user.skills,
  };
}
