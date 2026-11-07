import Link from "next/link";
import { ArrowRight, CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import type { OnboardingStep, OnboardingStepId } from "@/features/dashboard/metrics";
import { cn } from "@/lib/utils";

const copy = strings.pages.dashboard;

const HREFS: Record<OnboardingStepId, string> = {
  library: "/library",
  job: "/jobs/new",
  tailor: "/jobs",
  export: "/jobs",
};

type StepState = "done" | "current" | "upcoming";

export function GettingStarted({ steps }: { steps: OnboardingStep[] }) {
  const currentIndex = steps.findIndex((step) => !step.done);
  const current = currentIndex === -1 ? null : steps[currentIndex];

  return (
    <section
      aria-labelledby="getting-started-heading"
      className="rounded-card border border-line bg-surface px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-pine uppercase">
            {copy.gettingStarted}
          </p>
          <h2
            id="getting-started-heading"
            className="mt-2 font-serif text-xl font-semibold tracking-tight text-balance text-ink sm:text-2xl"
          >
            {copy.setupTitle}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate">{copy.setupBody}</p>
          {current ? (
            <Button asChild className="mt-4 h-11 w-full px-4 sm:w-auto">
              <Link href={HREFS[current.id]}>
                {copy.steps[current.id]}
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>

        <ol className="min-w-0 border-t border-line pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          {steps.map((step, index) => {
            const state: StepState = step.done
              ? "done"
              : index === currentIndex
                ? "current"
                : "upcoming";
            return (
              <li
                key={step.id}
                className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3"
              >
                <div className="flex flex-col items-center">
                  <div className="flex h-11 items-center">
                    <StepMarker state={state} index={index} />
                  </div>
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden
                      className={cn(
                        "min-h-3 w-px flex-1",
                        step.done ? "bg-pine/40" : "bg-line",
                      )}
                    />
                  ) : null}
                </div>
                {state === "current" ? (
                  <div
                    aria-current="step"
                    className="mb-3 rounded-md bg-pine-50 px-2.5 dark:bg-pine/15"
                  >
                    <div className="flex min-h-11 items-center">
                      <StepLabel step={step} state={state} />
                    </div>
                    <p className="pb-2.5 text-sm leading-snug text-slate">
                      {copy.stepPurpose[step.id]}
                    </p>
                  </div>
                ) : (
                  <StepLink step={step} state={state} last={index === steps.length - 1} />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function StepLink({
  step,
  state,
  last,
}: {
  step: OnboardingStep;
  state: Exclude<StepState, "current">;
  last: boolean;
}) {
  return (
    <Link
      href={HREFS[step.id]}
      className={cn(
        "flex min-h-11 items-center rounded-md px-2.5 no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        !last && "mb-1",
      )}
    >
      <StepLabel step={step} state={state} />
    </Link>
  );
}

function StepLabel({ step, state }: { step: OnboardingStep; state: StepState }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span
        className={cn(
          "text-sm",
          state === "current" && "font-semibold text-ink",
          state === "done" && "font-medium text-ink",
          state === "upcoming" && "font-medium text-slate",
        )}
      >
        {copy.steps[step.id]}
      </span>
      {state === "done" ? (
        <span className="text-xs font-medium text-pine">{copy.stepDone}</span>
      ) : null}
      {state === "current" ? (
        <span className="text-xs font-medium text-pine">{copy.stepCurrent}</span>
      ) : null}
    </span>
  );
}

function StepMarker({ state, index }: { state: StepState; index: number }) {
  const frame =
    "relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold";

  if (state === "done") {
    return (
      <span className={cn(frame, "bg-pine-50 text-pine dark:bg-pine/20 dark:text-pine-300")}>
        <CheckIcon className="size-3.5" aria-hidden />
      </span>
    );
  }

  if (state === "current") {
    return (
      <span className={cn(frame, "bg-pine text-white")} aria-hidden>
        {index + 1}
      </span>
    );
  }

  return (
    <span className={cn(frame, "border border-line bg-surface text-slate")} aria-hidden>
      {index + 1}
    </span>
  );
}
