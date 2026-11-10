"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Move to the next line, then stay there. The bar keeps moving. */
export function nextHeldStage(current: number, count: number): number {
  if (count <= 1) return 0;
  return Math.min(Math.max(current, 0) + 1, count - 1);
}

const STEP_MS = 8_000;

/**
 * Indeterminate work panel: pine spinner, sliding bar, and ordered lines.
 * No percentage. Motion stays off when the user prefers reduced motion.
 */
export function WorkProgress({
  title,
  hint,
  stages,
}: {
  title: string;
  hint: string;
  stages: readonly string[];
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stages.length <= 1) return;
    const id = window.setInterval(() => {
      setStage((current) => nextHeldStage(current, stages.length));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [stages.length]);

  const current = stages[stage] ?? title;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="rounded-card border border-line bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        <span
          className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center"
          aria-hidden
        >
          <span className="absolute inset-0 rounded-full border-2 border-pine-50 dark:border-pine/30" />
          <span className="import-read-arc absolute inset-0 rounded-full border-2 border-transparent border-t-pine dark:border-t-pine-300" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="mt-1 text-sm text-slate">{hint}</p>
        </div>
      </div>
      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-pine-50 dark:bg-pine/25"
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={current}
      >
        <div className="import-read-bar h-full w-1/3 rounded-full bg-pine dark:bg-pine-300" />
      </div>
      <ol className="mt-4 grid gap-1">
        {stages.map((line, index) => {
          const state = index < stage ? "done" : index === stage ? "current" : "upcoming";
          return (
            <li
              key={line}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex min-h-8 items-center gap-2.5 rounded-md px-2",
                state === "current" && "bg-pine-50 dark:bg-pine/15",
              )}
            >
              <StepMark state={state} />
              <span
                className={cn(
                  "text-sm",
                  state === "current" ? "font-medium text-ink" : "text-slate",
                )}
              >
                {line}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepMark({ state }: { state: "done" | "current" | "upcoming" }) {
  if (state === "done") {
    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center" aria-hidden>
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-pine-50 text-pine dark:bg-pine/20 dark:text-pine-300">
          <CheckIcon className="size-3" />
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center" aria-hidden>
      <span
        className={cn(
          "size-2.5 rounded-full",
          state === "current"
            ? "work-progress-dot bg-pine dark:bg-pine-300"
            : "border border-line bg-surface",
        )}
      />
    </span>
  );
}
