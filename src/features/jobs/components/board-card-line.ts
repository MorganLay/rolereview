import type { BoardCardDisplay } from "../format";

export type BoardCardSecondaryLine =
  | { kind: "deadline"; note: "soon" | "past" }
  | { kind: "match" };

/**
 * The one extra line on a board card.
 * A deadline marked soon or past wins. No due deadline means the match score.
 */
export function boardCardSecondaryLine(
  deadlineNote: BoardCardDisplay["deadlineNote"],
): BoardCardSecondaryLine {
  if (deadlineNote === "soon" || deadlineNote === "past") {
    return { kind: "deadline", note: deadlineNote };
  }
  return { kind: "match" };
}
