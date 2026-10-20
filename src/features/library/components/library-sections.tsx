"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { ENTRY_KINDS } from "@/features/library/schemas";

import { reorderEntry } from "../actions";
import type { LibraryEntry } from "../types";
import { DeleteEntryDialog } from "./delete-entry-dialog";
import { EntryCard } from "./entry-card";
import { EntryDialog, type EntryEditor } from "./entry-dialog";

type LibrarySectionsProps = {
  entries: LibraryEntry[];
};

const copy = strings.library.entries;

export function LibrarySections({ entries }: LibrarySectionsProps) {
  const [editor, setEditor] = useState<EntryEditor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LibraryEntry | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
        const section = entries.filter((entry) => entry.kind === kind);
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
          entry={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
