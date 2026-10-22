/**
 * Which library refs a letter should lean on.
 * docs/05-AI.md → COVER_LETTER → resume focus.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeContent } from "@/features/tailor/schemas";

/** Source refs of included bullets, in reading order, without duplicates. */
export function includedBulletRefs(content: ResumeContent): string[] {
  const refs: string[] = [];
  for (const entry of content.entries) {
    if (!entry.included) continue;
    for (const bullet of entry.bullets) {
      if (!bullet.included) continue;
      for (const ref of bullet.sourceRefs) {
        if (!refs.includes(ref)) refs.push(ref);
      }
    }
  }
  return refs;
}

/**
 * Rewrite a resume's refs onto the library snapshot this letter will see.
 * Matching is by entry, bullet, and skill id. A missing id is left out.
 */
export function focusRefsForLibrary(
  refs: readonly string[],
  resumeSnapshot: LibrarySnapshot,
  currentSnapshot: LibrarySnapshot,
): string[] {
  const idByRef = new Map<string, string>();
  for (const entry of resumeSnapshot.entries) {
    idByRef.set(entry.ref, entry.id);
    for (const bullet of entry.bullets) idByRef.set(bullet.ref, bullet.id);
  }
  for (const skill of resumeSnapshot.skills) idByRef.set(skill.ref, skill.id);

  const refById = new Map<string, string>();
  for (const entry of currentSnapshot.entries) {
    refById.set(entry.id, entry.ref);
    for (const bullet of entry.bullets) refById.set(bullet.id, bullet.ref);
  }
  for (const skill of currentSnapshot.skills) refById.set(skill.id, skill.ref);

  const focused: string[] = [];
  for (const ref of refs) {
    const id = idByRef.get(ref);
    if (!id) continue;
    const current = refById.get(id);
    if (!current || focused.includes(current)) continue;
    focused.push(current);
  }
  return focused;
}
