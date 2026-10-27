/** How long a delete waits before it is sent. docs/06-ROADMAP.md → TQ.13. */
export const UNDO_DELETE_MS = 8_000;

export type UndoPhase = "pending" | "restore" | "commit";

/** How the undo toast ended. Unmount flushes the delete. */
export type UndoSignal = "undo" | "expire" | "dismiss" | "unmount";

/**
 * Undo puts the row back and does not delete.
 * Expiry, dismiss, and unmount send the delete.
 * A later signal does not change that outcome.
 */
export function settleUndo(phase: UndoPhase, signal: UndoSignal): UndoPhase {
  if (phase !== "pending") return phase;
  return signal === "undo" ? "restore" : "commit";
}

export function addHidden(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (ids.has(id)) return ids;
  const next = new Set(ids);
  next.add(id);
  return next;
}

export function removeHidden(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!ids.has(id)) return ids;
  const next = new Set(ids);
  next.delete(id);
  return next;
}
