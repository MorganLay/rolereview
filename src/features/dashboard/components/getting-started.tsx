import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { strings } from "@/copy/strings";
import type { OnboardingStep, OnboardingStepId } from "@/features/dashboard/metrics";

const copy = strings.pages.dashboard;

const HREFS: Record<OnboardingStepId, string> = {
  library: "/library",
  job: "/jobs/new",
  tailor: "/jobs",
  export: "/jobs",
};

export function GettingStarted({ steps }: { steps: OnboardingStep[] }) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="getting-started-heading" className="flex flex-col gap-3">
        <h2 id="getting-started-heading" className="text-base font-medium text-ink">
          {copy.gettingStarted}
        </h2>
        <p className="text-sm text-slate">{copy.gettingStartedBody}</p>
        <ol className="flex flex-col">
          {steps.map((step, index) => (
            <li key={step.id} className="border-b border-line py-3 last:border-b-0">
              <Link
                href={HREFS[step.id]}
                className="flex items-start gap-3 rounded-sm text-sm text-ink underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center">
                  {step.done ? (
                    <CheckIcon className="size-4 text-pine" aria-hidden />
                  ) : (
                    <span className="text-xs text-slate tabular-nums" aria-hidden>
                      {index + 1}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="text-slate">{step.done ? copy.stepDone : copy.stepToDo}</span>
                  <span className="text-ink"> · {copy.steps[step.id]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="how-heading" className="flex flex-col gap-3">
        <h2 id="how-heading" className="text-base font-medium text-ink">
          {copy.howTitle}
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink">
          {copy.howSteps.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
