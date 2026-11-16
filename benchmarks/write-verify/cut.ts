/**
 * Applies a page-cut reply. A merge that introduces a number or a
 * capitalised token the source lines do not contain is refused.
 * More than half the lines cannot be dropped in one reply.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeContent } from "@/features/tailor/schemas";

export type CutReply = {
  drop: readonly string[];
  merge: readonly { ids: readonly string[]; text: string }[];
};

export type CutLog = {
  dropped: string[];
  merged: { ids: string[]; text: string }[];
  refused: string[];
  reason?: string;
};

const CREDENTIAL = /\b(?:b\.?\s?[as]\.?|m\.?\s?[as]\.?|ph\.?\s?d\.?|mba|nebosh|cpa)\b/i;

type Line = { id: string; text: string };

export function applyCut(content: ResumeContent, reply: CutReply): { content: ResumeContent; log: CutLog } {
  const lines = includedLines(content);
  const byId = new Map(lines.map((line) => [line.id, line]));
  const refused: string[] = [];
  const merged: { ids: string[]; text: string }[] = [];
  const used = new Set<string>();
  const replacements = new Map<string, { text: string; alsoOff: string[] }>();

  for (const merge of reply.merge) {
    const ids = [...new Set(merge.ids.map((id) => id.trim()).filter((id) => id.length > 0))];
    const sources = ids.flatMap((id) => {
      const line = byId.get(id);
      return line ? [line] : [];
    });
    if (sources.length < 2 || sources.length !== ids.length || ids.some((id) => used.has(id))) {
      refused.push(`merge:${ids.join("+") || "empty"}`);
      continue;
    }
    const text = merge.text.replace(/\s+/g, " ").trim();
    if (text.length === 0 || novelToken(text, sources)) {
      refused.push(`merge:${ids.join("+")}`);
      continue;
    }
    for (const id of ids) used.add(id);
    const [keep, ...rest] = ids;
    if (!keep) continue;
    replacements.set(keep, { text, alsoOff: rest });
    merged.push({ ids, text });
  }

  const requested = reply.drop.map((id) => id.trim()).filter((id) => byId.has(id) && !used.has(id));
  const unique = [...new Set(requested)];
  const ceiling = Math.ceil(lines.length / 2);
  const dropped = unique.slice(0, ceiling);
  if (unique.length > ceiling) refused.push(`drop-cap:${unique.length}`);

  const off = new Set<string>(dropped);
  for (const replacement of replacements.values()) {
    for (const id of replacement.alsoOff) off.add(id);
  }

  const next: ResumeContent = {
    ...content,
    entries: content.entries.map((entry) => ({
      ...entry,
      bullets: entry.bullets.map((bullet) => {
        const replacement = replacements.get(bullet.id);
        if (replacement) {
          return { ...bullet, text: replacement.text, included: true };
        }
        if (off.has(bullet.id)) return { ...bullet, included: false };
        return bullet;
      }),
    })),
  };
  return { content: next, log: { dropped, merged, refused } };
}

export function includedCutLines(content: ResumeContent): { id: string; entry: string; text: string }[] {
  const lines: { id: string; entry: string; text: string }[] = [];
  for (const entry of content.entries) {
    if (!entry.included) continue;
    for (const bullet of entry.bullets) {
      if (!bullet.included) continue;
      lines.push({ id: bullet.id, entry: entry.ref, text: bullet.text });
    }
  }
  return lines;
}

/**
 * W5 cut. The first line of the most relevant role stays.
 * A line that is the only place a number, credential, or named system appears
 * stays while any other line can still be cut.
 */
export function applyW5Cut(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  reply: CutReply & { reason: string },
): { content: ResumeContent; log: CutLog } {
  const lines = includedCutLines(content);
  const first = firstRelevantBullet(content, snapshot);
  const ordinary = lines.filter((line) => line.id !== first && !onlyFact(line, lines));
  const refused: string[] = [];
  const drop: string[] = [];
  for (const id of reply.drop) {
    if (id === first) {
      refused.push(`first-line:${id}`);
      continue;
    }
    const line = lines.find((item) => item.id === id);
    if (line && onlyFact(line, lines) && ordinary.length > 0) {
      refused.push(`only-fact:${id}`);
      continue;
    }
    drop.push(id);
  }
  const applied = applyCut(content, { drop, merge: reply.merge });
  return {
    content: applied.content,
    log: { ...applied.log, refused: [...refused, ...applied.log.refused], reason: reply.reason },
  };
}

function firstRelevantBullet(content: ResumeContent, snapshot: LibrarySnapshot): string | null {
  const kind = new Map(snapshot.entries.map((entry) => [entry.ref, entry.kind]));
  for (const entry of content.entries) {
    if (!entry.included || kind.get(entry.ref) !== "EXPERIENCE") continue;
    const bullet = entry.bullets.find((item) => item.included);
    return bullet?.id ?? null;
  }
  return null;
}

function onlyFact(line: { id: string; text: string }, lines: readonly { id: string; text: string }[]): boolean {
  const tokens = factTokens(line.text);
  if (tokens.length === 0) return false;
  const others = lines.filter((item) => item.id !== line.id).map((item) => item.text);
  return tokens.some((token) => others.every((text) => !text.toLowerCase().includes(token.toLowerCase())));
}

function factTokens(text: string): string[] {
  const numbers = text.match(/\d[\d,.%+]*/g) ?? [];
  const systems = text.match(/\b[A-Z]{2,}\b/g) ?? [];
  const credentials = text.match(CREDENTIAL) ?? [];
  return [...numbers, ...systems, ...credentials];
}

function includedLines(content: ResumeContent): Line[] {
  return includedCutLines(content).map((line) => ({ id: line.id, text: line.text }));
}

function novelToken(text: string, sources: readonly Line[]): boolean {
  const pool = sources.map((line) => line.text).join(" ");
  const numbers = text.match(/\d[\d,.]*/g) ?? [];
  for (const token of numbers) {
    const bare = token.replace(/[^\d]/g, "");
    if (bare.length === 0) continue;
    const present = (pool.match(/\d[\d,.]*/g) ?? []).some((item) => item.replace(/[^\d]/g, "") === bare);
    if (!present) return true;
  }
  const capitals = text.match(/\b[A-Z]{2,}\b/g) ?? [];
  for (const token of capitals) {
    if (!pool.includes(token)) return true;
  }
  return false;
}
