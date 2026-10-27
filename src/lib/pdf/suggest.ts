/**
 * Bullets to turn off when a 1-page resume is still over.
 * Does not change the resume. Text is the included bullet, not a rewrite.
 */

import { ENTRY_KINDS } from "@/features/library/schemas";
import type { ResumeContent } from "@/features/tailor/schemas";

const SUGGEST_LIMIT = 3;

export type BulletSuggestion = {
  id: string;
  text: string;
};

export type EvidenceVerdict = {
  evidenceRefs: readonly string[];
};

type SkillRef = {
  ref: string;
  name: string;
};

type IncludedBullet = {
  id: string;
  text: string;
  sourceRefs: readonly string[];
};

/**
 * Up to three included bullets.
 * Prefer bullets no evidenced requirement cites.
 * When every included bullet is cited, use the ones latest in the document.
 * Latest means entry-kind order, then entry order, then bullet order.
 */
export function suggestBulletsToTurnOff(
  content: ResumeContent,
  verdicts: readonly EvidenceVerdict[],
  skills: readonly SkillRef[] = [],
): BulletSuggestion[] {
  const included = includedBullets(content);
  if (included.length === 0) return [];
  const cited = citedSourceRefs(content, verdicts, skills);
  const uncited = included.filter(
    (bullet) => !bullet.sourceRefs.some((ref) => cited.has(ref)),
  );
  const pool = uncited.length > 0 ? uncited : included;
  return pool.slice(-SUGGEST_LIMIT).map((bullet) => ({ id: bullet.id, text: bullet.text }));
}

function includedBullets(content: ResumeContent): IncludedBullet[] {
  const bullets: IncludedBullet[] = [];
  for (const kind of ENTRY_KINDS) {
    for (const entry of content.entries) {
      if (entry.kind !== kind || !entry.included) continue;
      for (const bullet of entry.bullets) {
        if (!bullet.included) continue;
        const text = bullet.text.replace(/\s+/g, " ").trim();
        if (text.length === 0) continue;
        bullets.push({ id: bullet.id, text, sourceRefs: bullet.sourceRefs });
      }
    }
  }
  return bullets;
}

function citedSourceRefs(
  content: ResumeContent,
  verdicts: readonly EvidenceVerdict[],
  skills: readonly SkillRef[],
): Set<string> {
  const onResume = refsOnResume(content, skills);
  const cited = new Set<string>();
  for (const verdict of verdicts) {
    const refs = verdict.evidenceRefs;
    if (!refs.some((ref) => onResume.has(ref))) continue;
    for (const ref of refs) cited.add(ref);
  }
  return cited;
}

function refsOnResume(content: ResumeContent, skills: readonly SkillRef[]): Set<string> {
  const refs = new Set<string>();
  for (const entry of content.entries) {
    if (!entry.included) continue;
    refs.add(entry.ref);
    for (const bullet of entry.bullets) {
      if (!bullet.included) continue;
      for (const ref of bullet.sourceRefs) refs.add(ref);
    }
  }
  const names = new Set(content.skills.flatMap((group) => group.names));
  for (const skill of skills) {
    if (names.has(skill.name)) refs.add(skill.ref);
  }
  return refs;
}
