"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";

import { strings } from "@/copy/strings";
import type { TailoringOverview } from "@/features/tailor/overview";
import { cn } from "@/lib/utils";

const copy = strings.jobs.workspace.overview;

export function TailoringOverviewPanel({
  overview,
  onOpen,
}: {
  resumeId: string;
  overview: TailoringOverview;
  onOpen: (elementId: string) => void;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const line = overview.line.length > 0 ? overview.line : copy.reviewDecisions;

  return (
    <section aria-label={copy.title} className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-4"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? `${copy.title}. ${copy.collapse}` : `${copy.title}. ${line}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">{copy.title}</span>
          <span className="mt-0.5 block text-sm break-words text-slate">{line}</span>
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0 text-slate transition-transform duration-200 ease-out motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      <div id={panelId} hidden={!open} className="border-t border-line px-3 py-3 sm:px-4">
        {overview.strategy.length > 0 ? (
          <p className="text-sm leading-relaxed text-slate">{overview.strategy}</p>
        ) : null}
        {overview.decisions.length === 0 ? (
          <p className={cn("text-sm text-slate", overview.strategy.length > 0 && "mt-3")}>
            {copy.noFurther}
          </p>
        ) : (
          <ul className={cn("grid gap-3", overview.strategy.length > 0 && "mt-3")}>
            {overview.decisions.map((decision) => (
              <li key={decision.id} className="min-w-0">
                <p className="text-sm font-medium text-ink">{decision.heading}</p>
                <p className="mt-0.5 text-sm leading-relaxed break-words text-slate">{decision.body}</p>
                {decision.links.length > 0 ? (
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {decision.links.map((link) => (
                      <button
                        key={`${decision.id}-${link.elementId}-${link.label}`}
                        type="button"
                        className="text-left text-sm break-words text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        onClick={() => onOpen(link.elementId)}
                      >
                        {link.label}
                      </button>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
