/**
 * Turns the production import result into the snapshot shape the tailor sees.
 * Refs are assigned here. No resume text is rewritten.
 */
import type { ExtractedResume } from "@/features/import/extract";
import { LibrarySnapshot, ProfileLink, type LibrarySnapshot as Snapshot } from "@/features/library/schemas";

export function snapshotFromImport(extracted: ExtractedResume): Snapshot {
  let bulletCount = 0;
  const snapshot: Snapshot = {
    takenAt: new Date().toISOString(),
    profile: {
      fullName: extracted.profile.fullName,
      headline: extracted.profile.headline,
      email: extracted.profile.email ?? "",
      phone: extracted.profile.phone,
      location: extracted.profile.location,
      links: extracted.profile.links
        .flatMap((link) => {
          const parsed = ProfileLink.safeParse(link);
          return parsed.success ? [parsed.data] : [];
        })
        .slice(0, 5),
      summary: extracted.profile.summary,
    },
    entries: extracted.entries.map((entry, index) => ({
      ref: `E${index + 1}`,
      id: `E${index + 1}`,
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization,
      location: entry.location,
      startDate: entry.startDate,
      endDate: entry.endDate,
      isCurrent: entry.isCurrent,
      url: entry.url,
      bullets: entry.bullets.map((bullet) => {
        bulletCount += 1;
        return { ref: `B${bulletCount}`, id: `B${bulletCount}`, text: bullet.text };
      }),
    })),
    skills: extracted.skills.map((skill, index) => ({
      ref: `S${index + 1}`,
      id: `S${index + 1}`,
      name: skill.name,
      category: skill.category,
    })),
  };
  return LibrarySnapshot.parse(snapshot);
}
