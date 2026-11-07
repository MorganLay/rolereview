import Link from "next/link";
import { ArrowRight, CheckIcon, Layers, Shield, Zap } from "lucide-react";

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

const TRUST_ICONS = [Shield, Layers, Zap] as const;

type StepState = "done" | "current" | "upcoming";

export function GettingStarted({ steps }: { steps: OnboardingStep[] }) {
  const currentIndex = steps.findIndex((step) => !step.done);
  const current = currentIndex === -1 ? null : steps[currentIndex];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section
        aria-labelledby="getting-started-heading"
        className="rounded-card border border-line bg-surface px-4 py-5 sm:px-6 sm:py-6"
      >
        <div className="xl:grid xl:grid-cols-2 xl:items-start">
          <div className="min-w-0 xl:pr-10">
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
              <Button asChild className="mt-5 min-h-11 w-full px-4 sm:w-auto">
                <Link href={HREFS[current.id]}>
                  {copy.steps[current.id]}
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>

          <ol className="mt-6 min-w-0 border-t border-line pt-5 xl:mt-0 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-10">
            {steps.map((step, index) => {
              const state: StepState = step.done
                ? "done"
                : index === currentIndex
                  ? "current"
                  : "upcoming";
              return (
                <li key={step.id} className="relative pb-4 last:pb-0">
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-7 bottom-0 left-[13px] w-px",
                        step.done ? "bg-pine/40" : "bg-line",
                      )}
                    />
                  ) : null}
                  <Link
                    href={HREFS[step.id]}
                    aria-current={state === "current" ? "step" : undefined}
                    className="relative flex min-h-11 items-start gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <StepMarker state={state} index={index} />
                    <span className="min-w-0 pt-0.5">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span
                          className={cn(
                            "text-sm text-ink",
                            state === "current" ? "font-semibold" : "font-medium",
                          )}
                        >
                          {copy.steps[step.id]}
                        </span>
                        {state === "done" ? (
                          <span className="text-xs font-medium text-pine">{copy.stepDone}</span>
                        ) : null}
                        {state === "current" ? (
                          <span className="sr-only">{copy.stepCurrent}</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-sm leading-snug text-slate">
                        {copy.stepDetails[step.id]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <ul aria-label={copy.trustLabel} className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {copy.trust.map((item, index) => {
          const Icon = TRUST_ICONS[index] ?? Shield;
          return (
            <li key={item.title} className="flex min-w-0 items-start gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-pine" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{item.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-slate">{item.body}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StepMarker({ state, index }: { state: StepState; index: number }) {
  const frame =
    "relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold";

  if (state === "done") {
    return (
      <span className={cn(frame, "bg-pine-50 text-pine")}>
        <CheckIcon className="size-3.5" aria-hidden />
      </span>
    );
  }

  if (state === "current") {
    return <span className={cn(frame, "bg-pine text-white")}>{index + 1}</span>;
  }

  return (
    <span className={cn(frame, "border border-line bg-surface text-slate")}>{index + 1}</span>
  );
}
