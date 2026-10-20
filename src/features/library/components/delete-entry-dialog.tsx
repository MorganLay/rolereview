"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { strings } from "@/copy/strings";

import { deleteEntry } from "../actions";
import type { LibraryEntry } from "../types";

type DeleteEntryDialogProps = {
  entry: LibraryEntry;
  onClose: () => void;
};

const copy = strings.library.entries;

export function DeleteEntryDialog({ entry, onClose }: DeleteEntryDialogProps) {
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    if (busy || pending) return;
    if (!next) onClose();
  }

  function onConfirm(event: React.MouseEvent) {
    event.preventDefault();
    setBusy(true);
    startTransition(async () => {
      const result = await deleteEntry({ id: entry.id });
      setBusy(false);
      if (!result.ok) {
        toast.error(copy.deleteFailed);
        return;
      }
      toast.success(copy.deleted);
      onClose();
    });
  }

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-sans">{copy.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy.deleteBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy || pending}>
            {strings.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy || pending}
            onClick={onConfirm}
          >
            {busy || pending ? copy.deleting : strings.common.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
