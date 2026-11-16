import { createHash } from "node:crypto";

/**
 * A fingerprint of the library a question set was built from.
 * Skill rows have no updatedAt, so the name is part of the hash.
 */

export type RevisionEntry = {
  id: string;
  updatedAt: string;
  bullets: readonly { id: string; updatedAt: string }[];
};

export type RevisionSkill = {
  id: string;
  name: string;
};

export function libraryRevision(input: {
  entries: readonly RevisionEntry[];
  skills: readonly RevisionSkill[];
}): string {
  const lines: string[] = [];
  const entries = [...input.entries].sort((a, b) => a.id.localeCompare(b.id));
  for (const entry of entries) {
    lines.push(`e:${entry.id}:${entry.updatedAt}`);
    const bullets = [...entry.bullets].sort((a, b) => a.id.localeCompare(b.id));
    for (const bullet of bullets) lines.push(`b:${bullet.id}:${bullet.updatedAt}`);
  }
  const skills = [...input.skills].sort((a, b) => a.id.localeCompare(b.id));
  for (const skill of skills) lines.push(`s:${skill.id}:${skill.name}`);
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 32);
}
