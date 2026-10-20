import { moveWithinSection } from "./order";
import type { LibraryBullet } from "./types";

export type BulletOptimisticAction =
  | { type: "update"; id: string; text: string }
  | { type: "delete"; id: string }
  | { type: "create"; tempId: string; text: string }
  | { type: "reorder"; id: string; direction: "up" | "down" };

/** Next bullet list while a save is in flight. The server list is unchanged until it succeeds. */
export function applyBulletAction(
  current: readonly LibraryBullet[],
  action: BulletOptimisticAction,
): LibraryBullet[] {
  switch (action.type) {
    case "update":
      return current.map((bullet) =>
        bullet.id === action.id ? { ...bullet, text: action.text } : bullet,
      );
    case "delete":
      return current.filter((bullet) => bullet.id !== action.id);
    case "create":
      return [
        ...current,
        { id: action.tempId, text: action.text, sortOrder: current.length },
      ];
    case "reorder": {
      const next = moveWithinSection(current, action.id, action.direction);
      if (!next) return current.slice();
      const byId = new Map(current.map((bullet) => [bullet.id, bullet]));
      const ordered: LibraryBullet[] = [];
      for (const row of next) {
        const bullet = byId.get(row.id);
        if (bullet) ordered.push({ ...bullet, sortOrder: row.sortOrder });
      }
      return ordered;
    }
  }
}
