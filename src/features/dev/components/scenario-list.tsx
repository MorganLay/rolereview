"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import type { ScenarioName } from "../../../../prisma/scenarios";

import { loadScenario } from "../actions";

const copy = strings.pages.dev;

type ScenarioItem = {
  name: ScenarioName;
  title: string;
  body: string;
};

export function ScenarioList({ scenarios }: { scenarios: ScenarioItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<ScenarioName | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(name: ScenarioName) {
    setError(null);
    setActive(name);
    startTransition(async () => {
      const result = await loadScenario({ scenario: name });
      if (!result.ok) {
        setError(copy.failed);
        setActive(null);
        return;
      }
      router.push(`/dev?loaded=${result.data.scenario}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <ul className="flex flex-col gap-3">
        {scenarios.map((scenario) => (
          <li
            key={scenario.name}
            className="flex flex-col gap-3 rounded-lg border border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <h2 className="text-base font-medium text-ink">{scenario.title}</h2>
              <p className="mt-1 text-sm text-slate">{scenario.body}</p>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() => load(scenario.name)}
            >
              {pending && active === scenario.name ? strings.common.loading : copy.load}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}
