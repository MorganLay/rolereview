import { strings } from "@/copy/strings";

import type { BoardCardDisplay } from "../format";

export type BoardCardSecondaryLine =
  | { kind: "deadline"; note: "soon" | "past" }
  | { kind: "match" };

const board = strings.jobs.board;

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

/** A score reads as a match. An empty score says it has not been assessed. */
export function boardCardMatchText(matchLabel: string): string {
  if (matchLabel === board.emptyValue) return board.matchNotAssessed;
  return board.matchWithScore(matchLabel);
}
