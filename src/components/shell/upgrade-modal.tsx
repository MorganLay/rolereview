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
  presentUpgrade,
  type AllowanceCatalog,
} from "@/features/billing/present";

import { closeUpgradeModal, useUpgradeModal } from "./upgrade-store";

export function UpgradeModal({ catalog }: { catalog: AllowanceCatalog }) {
  const { open, target } = useUpgradeModal();
  const view = target ? presentUpgrade(target, catalog) : null;

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
            {view?.title ?? strings.upgrade.title}
          </DialogTitle>
          {view ? <DialogDescription>{view.description}</DialogDescription> : null}
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
