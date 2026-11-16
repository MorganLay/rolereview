/**
 * Compares an adapter library with an imported library.
 * Matching ignores case and punctuation. Dates are compared on matched entries.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";

type Entry = LibrarySnapshot["entries"][number];

export type LibraryDiff = {
  entriesOnlyAdapter: string[];
  entriesOnlyImport: string[];
  bulletsOnlyAdapter: string[];
  bulletsOnlyImport: string[];
  skillsOnlyAdapter: string[];
  skillsOnlyImport: string[];
  dates: { label: string; adapter: string; imported: string }[];
};

export function libraryDiff(adapter: LibrarySnapshot, imported: LibrarySnapshot): LibraryDiff {
  const adapterEntries = adapter.entries.map(labelOf);
  const importEntries = imported.entries.map(labelOf);
  const entryDelta = multiset(adapterEntries, importEntries);
  const bulletDelta = multiset(adapter.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)), imported.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)));
  const skillDelta = multiset(adapter.skills.map((skill) => skill.name), imported.skills.map((skill) => skill.name));
  return {
    entriesOnlyAdapter: entryDelta.onlyLeft,
    entriesOnlyImport: entryDelta.onlyRight,
    bulletsOnlyAdapter: bulletDelta.onlyLeft,
    bulletsOnlyImport: bulletDelta.onlyRight,
    skillsOnlyAdapter: skillDelta.onlyLeft,
    skillsOnlyImport: skillDelta.onlyRight,
    dates: dateChanges(adapter.entries, imported.entries),
  };
}

function dateChanges(left: readonly Entry[], right: readonly Entry[]): { label: string; adapter: string; imported: string }[] {
  const unused = right.map((entry) => ({ entry, used: false }));
  const changes: { label: string; adapter: string; imported: string }[] = [];
  for (const entry of left) {
    const match = unused.find((item) => !item.used && sameEntry(entry, item.entry));
    if (!match) continue;
    match.used = true;
    const adapterDate = dateText(entry);
    const importedDate = dateText(match.entry);
    if (adapterDate !== importedDate) {
      changes.push({ label: labelOf(entry), adapter: adapterDate, imported: importedDate });
    }
  }
  return changes;
}

function sameEntry(left: Entry, right: Entry): boolean {
  return norm(left.title) === norm(right.title) && norm(left.organization ?? "") === norm(right.organization ?? "");
}

function dateText(entry: Entry): string {
  const end = entry.isCurrent ? "present" : entry.endDate ?? "";
  return `${entry.startDate ?? ""}–${end}`;
}

function labelOf(entry: Entry): string {
  const org = entry.organization ? `, ${entry.organization}` : "";
  return `${entry.kind}: ${entry.title}${org}`;
}

function multiset(left: readonly string[], right: readonly string[]): { onlyLeft: string[]; onlyRight: string[] } {
  const rightCounts = new Map<string, number>();
  for (const item of right) rightCounts.set(norm(item), (rightCounts.get(norm(item)) ?? 0) + 1);
  const onlyLeft: string[] = [];
  for (const item of left) {
    const key = norm(item);
    const count = rightCounts.get(key) ?? 0;
    if (count > 0) rightCounts.set(key, count - 1);
    else onlyLeft.push(item);
  }
  const leftCounts = new Map<string, number>();
  for (const item of left) leftCounts.set(norm(item), (leftCounts.get(norm(item)) ?? 0) + 1);
  const onlyRight: string[] = [];
  for (const item of right) {
    const key = norm(item);
    const count = leftCounts.get(key) ?? 0;
    if (count > 0) leftCounts.set(key, count - 1);
    else onlyRight.push(item);
  }
  return { onlyLeft, onlyRight };
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
