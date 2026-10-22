"use client";

import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

export function PlanUpgradeButton() {
  return (
    <Button type="button" onClick={() => openUpgradeModal({ kind: "plan" })}>
      {strings.billing.upgrade}
    </Button>
  );
}
