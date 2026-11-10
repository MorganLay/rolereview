"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";

import { strings } from "@/copy/strings";
import type { TailoringOverview } from "@/features/tailor/overview";
import { cn } from "@/lib/utils";

const copy = strings.jobs.workspace.overview;

/** This browser has collapsed the overview for this resume. */
function storageKey(resumeId: string): string {
  return `rolerefine.tailoring-overview.${resumeId}`;
}

function hasReviewed(resumeId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(resumeId)) === "1";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();

function emitReview() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function rememberReview(resumeId: string) {
  try {
    window.localStorage.setItem(storageKey(resumeId), "1");
  } catch {
    // A blocked store still lets this visit collapse.
  }
  emitReview();
}

/** False on the server, so the first visit renders expanded. */
function useReviewed(resumeId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hasReviewed(resumeId),
    () => false,
  );
}

export function TailoringOverviewPanel({
  resumeId,
  overview,
  onOpen,
}: {
  resumeId: string;
  overview: TailoringOverview;
  onOpen: (elementId: string) => void;
}) {
  const panelId = useId();
  const reviewed = useReviewed(resumeId);
  const [choice, setChoice] = useState<{ resumeId: string; open: boolean } | null>(null);
  const open = choice?.resumeId === resumeId ? choice.open : !reviewed;

  function toggle() {
    const next = !open;
    if (!next) rememberReview(resumeId);
    setChoice({ resumeId, open: next });
  }

  return (
    <section aria-label={copy.title} className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-4"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? `${copy.title}. ${copy.collapse}` : `${copy.title}. ${copy.expand}`}
        onClick={toggle}
      >
        <span className="text-sm font-medium text-ink">{copy.title}</span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-slate transition-transform duration-200 ease-out motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      <div className="px-3 pb-3 sm:px-4">
        <p className="text-sm leading-relaxed text-slate">{overview.strategy}</p>
        {overview.metrics.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {overview.metrics.map((metric) => (
              <li
                key={metric.id}
                className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs text-ink"
              >
                {metric.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div id={panelId} hidden={!open} className="border-t border-line px-3 py-3 sm:px-4">
        {overview.decisions.length === 0 ? (
          <p className="text-sm text-slate">{copy.noFurther}</p>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {overview.decisions.map((decision) => (
              <li key={decision.id} className="min-w-0">
                <p className="text-sm font-medium text-ink">{decision.heading}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate">{decision.body}</p>
                {decision.links.length > 0 ? (
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {decision.links.map((link) => (
                      <button
                        key={`${decision.id}-${link.elementId}`}
                        type="button"
                        className="text-left text-sm text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
