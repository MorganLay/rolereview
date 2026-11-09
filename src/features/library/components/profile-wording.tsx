"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { strings } from "@/copy/strings";

import {
  approveProfileWording,
  discardWording,
  suggestProfileWording,
} from "../wording-actions";
import type { WordingView } from "../wording";

const copy = strings.library.assist;

export function ProfileWording({
  kind,
  wordings,
  defaultOpen = false,
}: {
  kind: "HEADLINE" | "SUMMARY";
  wordings: readonly WordingView[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const rows = wordings.filter((item) => item.kind === kind && item.jobId === null);
  const label = kind === "HEADLINE" ? copy.headlines : copy.summaries;
  const hideLabel = kind === "HEADLINE" ? copy.hideHeadlines : copy.hideSummaries;

  function suggest() {
    setOpen(true);
    startTransition(async () => {
      const result = await suggestProfileWording({
        kind: kind === "HEADLINE" ? "headline" : "summary",
      });
      if (!result.ok) {
        if (result.error.code === "QUOTA_EXCEEDED") {
          toast.error(copy.allowance);
          openUpgradeModal({ kind: "plan" });
        } else toast.error(copy.failed);
        return;
      }
      if (result.data.saved === 0) toast.message(copy.dropped);
    });
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className="text-[0.8125rem] text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? hideLabel : label}
          {open || rows.length === 0 ? "" : ` · ${rows.length}`}
        </button>
        <button
          type="button"
          className="text-[0.8125rem] text-slate underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
          disabled={pending}
          onClick={suggest}
        >
          {kind === "HEADLINE" ? copy.suggestHeadlines : copy.suggestSummary}
        </button>
      </div>
      {open ? (
        rows.length === 0 ? (
          <p className="text-[0.8125rem] text-slate">{copy.noneYet}</p>
        ) : (
          <ul className="grid gap-2.5 border-t border-line pt-2.5">
            {rows.map((item) => (
              <li key={item.id} className="grid gap-1">
                <p className="text-sm leading-relaxed text-ink">{item.text}</p>
                <p className="text-[0.75rem] text-slate">
                  {item.status === "PROPOSED"
                    ? item.reason
                    : item.isDefault
                      ? copy.default
                      : copy.approved}
                </p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {item.isDefault ? null : (
                    <button
                      type="button"
                      className="text-[0.8125rem] text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await approveProfileWording({
                            id: item.id,
                            text: item.text,
                            makeDefault: true,
                          });
                          if (!result.ok) {
                            toast.error(result.error.fields?.text?.[0] ?? copy.failed);
                            return;
                          }
                          setOpen(false);
                        });
                      }}
                    >
                      {item.status === "PROPOSED" ? copy.approve : copy.useDefault}
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-[0.8125rem] text-slate underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await discardWording({ id: item.id });
                        if (!result.ok) toast.error(copy.failed);
                      });
                    }}
                  >
                    {copy.discard}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
