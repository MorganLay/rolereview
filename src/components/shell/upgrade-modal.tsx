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
import { CheckoutActions } from "@/features/billing/components/checkout-actions";
import {
  presentUpgrade,
  type AllowanceCatalog,
  type CheckoutPrices,
} from "@/features/billing/present";

import { closeUpgradeModal, useUpgradeModal } from "./upgrade-store";

export function UpgradeModal({
  catalog,
  prices,
  foundingEligible,
  hasCustomer,
  plan,
}: {
  catalog: AllowanceCatalog;
  prices: CheckoutPrices;
  foundingEligible: boolean;
  hasCustomer: boolean;
  plan: "FREE" | "PRO";
}) {
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
        {view ? (
          <CheckoutActions
            prices={prices}
            foundingEligible={foundingEligible}
            hasCustomer={hasCustomer}
            plan={plan}
            fill
          />
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeUpgradeModal}>
            {strings.billing.notNow}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
