"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { strings } from "@/copy/strings";

import { settleUndo, UNDO_DELETE_MS, type UndoSignal } from "@/lib/undo-delete";

type Pending = {
  id: string;
  phase: "pending" | "restore" | "commit";
  toastId: string | number;
  commit: () => Promise<void> | void;
  restore: () => void;
};

/** Hide the row, then delete only if Undo is not chosen. */
export function useUndoDelete() {
  const pending = useRef(new Map<string, Pending>());

  const apply = useCallback((item: Pending, signal: UndoSignal) => {
    const next = settleUndo(item.phase, signal);
    if (next === item.phase) return;
    item.phase = next;
    pending.current.delete(item.id);
    if (signal === "unmount") toast.dismiss(item.toastId);
    if (next === "restore") {
      item.restore();
      return;
    }
    void Promise.resolve()
      .then(() => item.commit())
      .catch(() => {
        if (signal !== "unmount") item.restore();
      });
  }, []);

  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const item of [...map.values()]) apply(item, "unmount");
    };
  }, [apply]);

  const schedule = useCallback(
    (input: {
      id: string;
      message: string;
      commit: () => Promise<void> | void;
      restore: () => void;
    }) => {
      const existing = pending.current.get(input.id);
      if (existing?.phase === "pending") return;

      const item: Pending = {
        id: input.id,
        phase: "pending",
        toastId: "",
        commit: input.commit,
        restore: input.restore,
      };
      item.toastId = toast(input.message, {
        duration: UNDO_DELETE_MS,
        action: {
          label: strings.common.undo,
          onClick: () => apply(item, "undo"),
        },
        onDismiss: () => apply(item, "dismiss"),
        onAutoClose: () => apply(item, "expire"),
      });
      pending.current.set(input.id, item);
    },
    [apply],
  );

  return { schedule };
}
