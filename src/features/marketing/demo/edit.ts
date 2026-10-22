import type { ResumeContent } from "@/features/tailor/schemas";

export function setSummaryIncluded(
  content: ResumeContent,
  included: boolean,
): ResumeContent {
  return { ...content, summary: { ...content.summary, included } };
}

export function setEntryIncluded(
  content: ResumeContent,
  ref: string,
  included: boolean,
): ResumeContent {
  return {
    ...content,
    entries: content.entries.map((entry) =>
      entry.ref === ref ? { ...entry, included } : entry,
    ),
  };
}

export function setBulletIncluded(
  content: ResumeContent,
  entryRef: string,
  bulletId: string,
  included: boolean,
): ResumeContent {
  return {
    ...content,
    entries: content.entries.map((entry) =>
      entry.ref !== entryRef
        ? entry
        : {
            ...entry,
            bullets: entry.bullets.map((bullet) =>
              bullet.id === bulletId ? { ...bullet, included } : bullet,
            ),
          },
    ),
  };
}
