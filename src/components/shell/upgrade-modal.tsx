"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { strings } from "@/copy/strings";

import {
  closeUpgradeModal,
  useUpgradeModal,
} from "./upgrade-store";

export function UpgradeModal() {
  const { open, reason } = useUpgradeModal();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeUpgradeModal();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold">
            {strings.upgrade.title}
          </DialogTitle>
          <DialogDescription>
            {reason ? `${reason}. ${strings.upgrade.body}` : strings.upgrade.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={closeUpgradeModal}>
            {strings.upgrade.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
