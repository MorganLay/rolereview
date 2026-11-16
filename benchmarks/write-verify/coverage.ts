/**
 * Library items the draft has not put on the page.
 * A missing number, credential, or skill is listed once.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { TailorOutput } from "@/features/tailor/schemas";

export function coverageGaps(snapshot: LibrarySnapshot, pageText: string): string[] {
  const page = normalize(pageText);
  const items: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    const key = label.trim();
    if (key.length === 0 || seen.has(key.toLowerCase())) return;
    seen.add(key.toLowerCase());
    items.push(key);
  };

  for (const entry of snapshot.entries) {
    const credential = entry.kind === "CERTIFICATION" || /licen[cs]e/i.test(entry.title);
    if (credential && entry.title.trim().length > 0 && !contains(page, entry.title)) {
      add(`${entry.ref}: ${entry.title.trim()}`);
    }
    for (const bullet of entry.bullets) {
      for (const clause of bullet.text.split(";")) {
        const text = clause.trim();
        if (!/\d/.test(text)) continue;
        const numbers = (text.match(/\d[\d,.%$+]*/g) ?? []).map((token) => token.replace(/\.+$/, ""));
        if (numbers.length === 0) continue;
        if (numbers.every((token) => contains(page, token))) continue;
        add(`${bullet.ref}: ${text}`);
      }
    }
  }

  for (const skill of snapshot.skills) {
    const name = skill.name.trim();
    const head = name.split("(")[0]?.trim() ?? name;
    if (!contains(page, name) && !contains(page, head)) add(`${skill.ref}: ${name}`);
  }
  return items;
}

export function draftPage(draft: TailorOutput, snapshot: LibrarySnapshot): string {
  const lines = [draft.summary];
  for (const entry of draft.entries) {
    const source = snapshot.entries.find((item) => item.ref === entry.ref);
    if (source) lines.push(source.title, source.organization ?? "");
    for (const bullet of entry.bullets) lines.push(bullet.text);
  }
  for (const group of draft.skills) {
    for (const ref of group.refs) {
      const skill = snapshot.skills.find((item) => item.ref === ref);
      if (skill) lines.push(skill.name);
    }
  }
  return lines.join("\n");
}

export function applyCoverage(
  draft: TailorOutput,
  decisions: readonly { decision: string; ref: string; text: string }[],
): TailorOutput {
  let skills = draft.skills.map((group) => ({ ...group, refs: [...group.refs] }));
  const entries = draft.entries.map((entry) => ({ ...entry, bullets: [...entry.bullets] }));
  for (const decision of decisions) {
    if (decision.decision !== "add") continue;
    const ref = decision.ref.trim();
    const text = decision.text.trim();
    if (ref.startsWith("S")) {
      if (skills.some((group) => group.refs.includes(ref))) continue;
      skills = [...skills, { category: null, refs: [ref] }];
      continue;
    }
    if (text.length === 0) continue;
    const entryRef = ref.split(".")[0] ?? ref;
    let entry = entries.find((item) => item.ref === entryRef);
    if (!entry) {
      entry = { ref: entryRef, bullets: [] };
      entries.push(entry);
    }
    if (entry.bullets.some((bullet) => bullet.text.trim() === text)) continue;
    entry.bullets.push({ sourceRefs: [ref.includes(".") ? ref : entryRef], text });
  }
  return { ...draft, entries, skills };
}

export function applyCoveragePage(
  draft: TailorOutput,
  decisions: readonly { decision: string; ref: string; text: string; replaces?: string }[],
  pages: number,
): { draft: TailorOutput; applied: string[]; refused: string[] } {
  const applied: string[] = [];
  const refused: string[] = [];
  let next = draft;
  for (const decision of decisions) {
    const replaces = decision.replaces?.trim() ?? "";
    if (decision.decision === "decline") continue;
    if (decision.decision === "add" && pages > 1 && replaces.length === 0) {
        refused.push(decision.text);
      continue;
    }
    if (replaces.length > 0 || decision.decision === "replace") {
      const removed = removeLine(next, replaces);
      if (!removed.found) {
        refused.push(replaces || decision.text);
        continue;
      }
      next = applyCoverage(removed.draft, [{ decision: "add", ref: decision.ref, text: decision.text }]);
      applied.push(`replace:${replaces}`);
      continue;
    }
    next = applyCoverage(next, [{ decision: "add", ref: decision.ref, text: decision.text }]);
    applied.push(`add:${decision.text}`);
  }
  return { draft: next, applied, refused };
}

function removeLine(draft: TailorOutput, text: string): { draft: TailorOutput; found: boolean } {
  const needle = text.trim().toLowerCase();
  if (needle.length === 0) return { draft, found: false };
  let found = false;
  const entries = draft.entries.map((entry) => ({
    ...entry,
    bullets: entry.bullets.filter((bullet) => {
      if (found || bullet.text.trim().toLowerCase() !== needle) return true;
      found = true;
      return false;
    }),
  }));
  return { draft: { ...draft, entries }, found };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/,/g, "");
}

function contains(page: string, value: string): boolean {
  const needle = normalize(value).trim();
  if (needle.length < 2) return false;
  return page.includes(needle);
}
