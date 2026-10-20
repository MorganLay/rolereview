export type OrderedId = {
  id: string;
};

/**
 * Move one row up or down inside an already-sorted section.
 * Returns the section with `sortOrder` rewritten from 0, or null when the
 * row is missing or already at that end.
 */
export function moveWithinSection(
  rows: readonly OrderedId[],
  id: string,
  direction: "up" | "down",
): { id: string; sortOrder: number }[] | null {
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= rows.length) return null;

  const next = rows.slice();
  const current = next[index];
  const neighbour = next[target];
  if (!current || !neighbour) return null;
  next[index] = neighbour;
  next[target] = current;

  return next.map((row, sortOrder) => ({ id: row.id, sortOrder }));
}
