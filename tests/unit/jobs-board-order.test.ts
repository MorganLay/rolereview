import { describe, expect, it } from "vitest";

import {
  BOARD_ORDER_MIN_GAP,
  boardInsertIndex,
  dragInsertIndex,
  nextBoardOrder,
  planColumnMove,
  renumberColumn,
} from "@/features/jobs/board-order";

describe("nextBoardOrder", () => {
  it("uses the midpoint between neighbours", () => {
    expect(nextBoardOrder(1, 3)).toEqual({ boardOrder: 2 });
    expect(nextBoardOrder(0.25, 0.75)).toEqual({ boardOrder: 0.5 });
  });

  it("places a card one before the first", () => {
    expect(nextBoardOrder(null, 5)).toEqual({ boardOrder: 4 });
    expect(nextBoardOrder(null, -3)).toEqual({ boardOrder: -4 });
  });

  it("places a card one after the last", () => {
    expect(nextBoardOrder(5, null)).toEqual({ boardOrder: 6 });
    expect(nextBoardOrder(-0.5, null)).toEqual({ boardOrder: 0.5 });
  });

  it("starts an empty column at 0", () => {
    expect(nextBoardOrder(null, null)).toEqual({ boardOrder: 0 });
  });

  it("keeps a midpoint when the gap is exactly the minimum", () => {
    expect(nextBoardOrder(0, BOARD_ORDER_MIN_GAP)).toEqual({
      boardOrder: BOARD_ORDER_MIN_GAP / 2,
    });
  });

  it("renumbers when the gap is below the minimum", () => {
    expect(nextBoardOrder(0, BOARD_ORDER_MIN_GAP / 2)).toEqual({
      renumber: true,
    });
    expect(nextBoardOrder(2, 2)).toEqual({ renumber: true });
  });

  it("renumbers when the neighbours are reversed or not finite", () => {
    expect(nextBoardOrder(5, 1)).toEqual({ renumber: true });
    expect(nextBoardOrder(Number.NaN, 1)).toEqual({ renumber: true });
    expect(nextBoardOrder(1, Number.POSITIVE_INFINITY)).toEqual({
      renumber: true,
    });
  });

  it("midpoints large millisecond orders from new jobs", () => {
    const before = 1_700_000_000_000;
    expect(nextBoardOrder(before, before + 10)).toEqual({
      boardOrder: before + 5,
    });
    expect(nextBoardOrder(null, before)).toEqual({ boardOrder: before - 1 });
  });
});

describe("renumberColumn", () => {
  it("assigns 0, 1, 2 from the top", () => {
    expect(renumberColumn(["a", "b", "c"])).toEqual([
      { id: "a", boardOrder: 0 },
      { id: "b", boardOrder: 1 },
      { id: "c", boardOrder: 2 },
    ]);
  });

  it("returns nothing for an empty column", () => {
    expect(renumberColumn([])).toEqual([]);
  });
});

describe("planColumnMove", () => {
  const others = [
    { id: "a", boardOrder: 0 },
    { id: "b", boardOrder: 2 },
    { id: "c", boardOrder: 4 },
  ];

  it("inserts between neighbours", () => {
    expect(planColumnMove({ movingId: "m", others, index: 1 })).toEqual([
      { id: "m", boardOrder: 1 },
    ]);
  });

  it("inserts at the top and the bottom", () => {
    expect(planColumnMove({ movingId: "m", others, index: 0 })).toEqual([
      { id: "m", boardOrder: -1 },
    ]);
    expect(planColumnMove({ movingId: "m", others, index: 3 })).toEqual([
      { id: "m", boardOrder: 5 },
    ]);
  });

  it("starts an empty column at 0", () => {
    expect(planColumnMove({ movingId: "m", others: [], index: 0 })).toEqual([
      { id: "m", boardOrder: 0 },
    ]);
  });

  it("clamps an index that is past the ends or not a number", () => {
    expect(planColumnMove({ movingId: "m", others, index: 99 })).toEqual([
      { id: "m", boardOrder: 5 },
    ]);
    expect(planColumnMove({ movingId: "m", others, index: -4 })).toEqual([
      { id: "m", boardOrder: -1 },
    ]);
    expect(planColumnMove({ movingId: "m", others, index: Number.NaN })).toEqual(
      [{ id: "m", boardOrder: -1 }],
    );
    expect(planColumnMove({ movingId: "m", others, index: 1.9 })).toEqual([
      { id: "m", boardOrder: 1 },
    ]);
  });

  it("does not renumber an end move when some other gap is tight", () => {
    const tight = [
      { id: "a", boardOrder: 0 },
      { id: "b", boardOrder: 1e-9 },
    ];
    expect(planColumnMove({ movingId: "m", others: tight, index: 2 })).toEqual([
      { id: "m", boardOrder: 1e-9 + 1 },
    ]);
  });

  it("renumbers the whole column when the landing gap is too small", () => {
    const tight = [
      { id: "a", boardOrder: 0 },
      { id: "b", boardOrder: 1e-9 },
      { id: "c", boardOrder: 10 },
    ];
    expect(planColumnMove({ movingId: "m", others: tight, index: 1 })).toEqual([
      { id: "a", boardOrder: 0 },
      { id: "m", boardOrder: 1 },
      { id: "b", boardOrder: 2 },
      { id: "c", boardOrder: 3 },
    ]);
  });

  it("places a card after beforeId, or before afterId", () => {
    const ids = ["a", "b", "c"];
    expect(boardInsertIndex(ids, "b", "c")).toBe(2);
    expect(boardInsertIndex(ids, null, "b")).toBe(1);
    expect(boardInsertIndex(ids, "missing", "b")).toBe(1);
    expect(boardInsertIndex(ids, "c", null)).toBe(3);
    expect(boardInsertIndex(ids, null, null)).toBe(0);
    expect(boardInsertIndex([], null, null)).toBe(0);
  });
});

describe("dragInsertIndex", () => {
  it("moves a card down or up inside its column", () => {
    expect(
      dragInsertIndex({ movingId: "a", columnIds: ["a", "b", "c"], overId: "c" }),
    ).toBe(2);
    expect(
      dragInsertIndex({ movingId: "c", columnIds: ["a", "b", "c"], overId: "a" }),
    ).toBe(0);
  });

  it("leaves a card dropped on itself or alone on its column", () => {
    expect(
      dragInsertIndex({ movingId: "b", columnIds: ["a", "b", "c"], overId: "b" }),
    ).toBeNull();
    expect(dragInsertIndex({ movingId: "a", columnIds: ["a"], overId: null })).toBeNull();
  });

  it("inserts into another column before the card under the pointer", () => {
    expect(
      dragInsertIndex({ movingId: "m", columnIds: ["a", "b"], overId: "b" }),
    ).toBe(1);
    expect(dragInsertIndex({ movingId: "m", columnIds: ["a", "b"], overId: null })).toBe(2);
    expect(dragInsertIndex({ movingId: "m", columnIds: [], overId: null })).toBe(0);
  });
});

describe("planColumnMove neighbours", () => {
  it("drops the moving card from the neighbour list before placing it", () => {
    const withSelf = [
      { id: "a", boardOrder: 0 },
      { id: "m", boardOrder: 5 },
      { id: "b", boardOrder: 1e-9 },
    ];
    expect(planColumnMove({ movingId: "m", others: withSelf, index: 1 })).toEqual(
      [
        { id: "a", boardOrder: 0 },
        { id: "m", boardOrder: 1 },
        { id: "b", boardOrder: 2 },
      ],
    );
  });
});
