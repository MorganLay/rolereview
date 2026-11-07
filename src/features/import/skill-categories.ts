/**
 * Categories already on this resume, then the usual names.
 * The first spelling wins. Nothing here rewrites a skill.
 */
export function categoryChoices(
  categories: readonly string[],
  suggestions: readonly string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  function add(name: string) {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (key.length === 0 || seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  }

  for (const category of categories) add(category);
  for (const suggestion of suggestions) add(suggestion);
  return result;
}
