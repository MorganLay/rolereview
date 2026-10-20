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
