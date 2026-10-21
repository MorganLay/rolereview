/**
 * Fractional board positions. docs/03-ARCHITECTURE.md → Board ordering.
 * A move between neighbours uses their midpoint. Either end is ±1.
 * A gap below BOARD_ORDER_MIN_GAP renumbers the whole column to 0, 1, 2, …
 */

export const BOARD_ORDER_MIN_GAP = 1e-6;

export type BoardCard = {
  id: string;
  boardOrder: number;
};

export type BoardInsert = { boardOrder: number } | { renumber: true };

/** Order for a card placed between `before` and `after`. Null is an open end. */
export function nextBoardOrder(
  before: number | null,
  after: number | null,
): BoardInsert {
  if (
    (before !== null && !Number.isFinite(before)) ||
    (after !== null && !Number.isFinite(after))
  ) {
    return { renumber: true };
  }
  if (before === null) {
    return after === null ? { boardOrder: 0 } : { boardOrder: after - 1 };
  }
  if (after === null) return { boardOrder: before + 1 };
  if (after - before < BOARD_ORDER_MIN_GAP) return { renumber: true };
  return { boardOrder: (before + after) / 2 };
}

/** New integer positions for a column, top to bottom. */
export function renumberColumn(
  idsInOrder: readonly string[],
): { id: string; boardOrder: number }[] {
  return idsInOrder.map((id, boardOrder) => ({ id, boardOrder }));
}

/**
 * Where `movingId` should sit in a column.
 * `others` is every other card in that column, top to bottom.
 * `index` 0 is the top. Out-of-range indexes clamp.
 */
/**
 * Index among `otherIds` (the destination column, without the moving card).
 * `beforeId` wins when it is in the column. Otherwise `afterId`.
 * Unknown ids and a pair of nulls land at the top.
 */
export function boardInsertIndex(
  otherIds: readonly string[],
  beforeId: string | null,
  afterId: string | null,
): number {
  if (beforeId) {
    const index = otherIds.indexOf(beforeId);
    if (index >= 0) return index + 1;
  }
  if (afterId) {
    const index = otherIds.indexOf(afterId);
    if (index >= 0) return index;
  }
  return 0;
}

/**
 * Where a dragged card lands in the destination column.
 * Include `movingId` in `columnIds` only when it already sits in that column.
 * `overId` is the card under the pointer, or null on the column itself.
 * Null means the card stays put.
 */
export function dragInsertIndex(input: {
  movingId: string;
  columnIds: readonly string[];
  overId: string | null;
}): number | null {
  const from = input.columnIds.indexOf(input.movingId);
  const overIndex =
    input.overId === null ? -1 : input.columnIds.indexOf(input.overId);

  if (from >= 0) {
    const to = overIndex >= 0 ? overIndex : input.columnIds.length - 1;
    if (to < 0 || from === to) return null;
    return moveId(input.columnIds, from, to).indexOf(input.movingId);
  }

  if (overIndex >= 0) return overIndex;
  return input.columnIds.length;
}

function moveId(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (item === undefined) return next;
  next.splice(to, 0, item);
  return next;
}

export function planColumnMove(input: {
  movingId: string;
  others: readonly BoardCard[];
  index: number;
}): { id: string; boardOrder: number }[] {
  const others = input.others.filter((card) => card.id !== input.movingId);
  const raw = Number.isFinite(input.index) ? Math.trunc(input.index) : 0;
  const index = Math.min(Math.max(raw, 0), others.length);
  const before = index === 0 ? null : (others[index - 1]?.boardOrder ?? null);
  const after =
    index === others.length ? null : (others[index]?.boardOrder ?? null);
  const insert = nextBoardOrder(before, after);
  if ("boardOrder" in insert) {
    return [{ id: input.movingId, boardOrder: insert.boardOrder }];
  }
  const ids = [
    ...others.slice(0, index).map((card) => card.id),
    input.movingId,
    ...others.slice(index).map((card) => card.id),
  ];
  return renumberColumn(ids);
}
