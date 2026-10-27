"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { ENTRY_KINDS } from "@/features/library/schemas";
import { addHidden, removeHidden } from "@/lib/undo-delete";
import { useUndoDelete } from "@/lib/use-undo-delete";

import { deleteEntry, reorderEntry } from "../actions";
import type { LibraryEntry } from "../types";
import { DeleteEntryDialog } from "./delete-entry-dialog";
import { EntryCard } from "./entry-card";
import { EntryDialog, type EntryEditor } from "./entry-dialog";

type LibrarySectionsProps = {
  entries: LibraryEntry[];
  skills: readonly string[];
};

const copy = strings.library.entries;

export function LibrarySections({ entries, skills }: LibrarySectionsProps) {
  const [editor, setEditor] = useState<EntryEditor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LibraryEntry | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const { schedule } = useUndoDelete();
  const [, startTransition] = useTransition();

  function showEntry(id: string) {
    setHidden((current) => removeHidden(current, id));
  }

  function confirmDelete() {
    const entry = deleteTarget;
    if (!entry) return;
    setDeleteTarget(null);
    setHidden((current) => addHidden(current, entry.id));
    schedule({
      id: entry.id,
      message: copy.deleted,
      restore: () => showEntry(entry.id),
      commit: async () => {
        try {
          const result = await deleteEntry({ id: entry.id });
          if (!result.ok) {
            toast.error(copy.deleteFailed);
            showEntry(entry.id);
          }
        } catch {
          toast.error(copy.deleteFailed);
          showEntry(entry.id);
        }
      },
    });
  }

  function onMove(id: string, direction: "up" | "down") {
    setMovingId(id);
    startTransition(async () => {
      const result = await reorderEntry({ id, direction });
      setMovingId(null);
      if (!result.ok) toast.error(copy.reorderFailed);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {ENTRY_KINDS.map((kind) => {
        const kindCopy = copy.kinds[kind];
        const section = entries.filter(
          (entry) => entry.kind === kind && !hidden.has(entry.id),
        );
        return (
          <section key={kind} className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-medium text-ink">{kindCopy.title}</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditor({ mode: "create", kind })}
              >
                {kindCopy.add}
              </Button>
            </div>
            {section.length === 0 ? (
              <p className="text-sm text-slate">{copy.noneYet}</p>
            ) : (
              <div className="grid gap-3">
                {section.map((entry, index) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    skills={skills}
                    canMoveUp={index > 0}
                    canMoveDown={index < section.length - 1}
                    moving={movingId !== null}
                    onEdit={() => setEditor({ mode: "edit", entry })}
                    onDelete={() => setDeleteTarget(entry)}
                    onMove={(direction) => onMove(entry.id, direction)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {editor ? (
        <EntryDialog
          key={editor.mode === "edit" ? editor.entry.id : `new-${editor.kind}`}
          editor={editor}
          onClose={() => setEditor(null)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteEntryDialog
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
