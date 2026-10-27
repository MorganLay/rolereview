"use client";

import type { MouseEvent } from "react";

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

type DeleteEntryDialogProps = {
  onClose: () => void;
  onConfirm: () => void;
};

const copy = strings.library.entries;

export function DeleteEntryDialog({ onClose, onConfirm }: DeleteEntryDialogProps) {
  function onOpenChange(next: boolean) {
    if (!next) onClose();
  }

  function confirm(event: MouseEvent) {
    event.preventDefault();
    onConfirm();
  }

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-sans">{copy.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy.deleteBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{strings.common.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            {strings.common.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
