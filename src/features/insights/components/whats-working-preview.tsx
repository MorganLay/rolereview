"use client";

import { LockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { strings } from "@/copy/strings";

const copy = strings.insights;

export function WhatsWorkingPreview() {
  return (
    <section aria-labelledby="working-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="working-heading" className="text-base font-medium text-ink">
          {copy.whatsWorking}
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-slate">
          <LockIcon aria-hidden className="size-4" />
          {copy.proLabel}
        </p>
      </div>
      <p className="max-w-xl text-sm text-slate">{copy.proPreview}</p>
      <div aria-hidden className="flex max-w-sm flex-col gap-2 blur-sm">
        <div className="h-3 w-4/5 rounded-full bg-pine" />
        <div className="h-3 w-3/5 rounded-full bg-marigold" />
        <div className="h-3 w-2/5 rounded-full bg-slate" />
      </div>
      <Button
        type="button"
        className="w-fit"
        onClick={() => openUpgradeModal({ kind: "feature", feature: "insights:whats-working" })}
      >
        <LockIcon aria-hidden />
        {copy.upgrade}
      </Button>
    </section>
  );
}
