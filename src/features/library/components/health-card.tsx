"use client";

import { strings } from "@/copy/strings";

import type { HealthCheckId, LibraryHealth, ProfileFieldId } from "../health";

type HealthCardProps = {
  health: LibraryHealth;
  onOpenField: (field: ProfileFieldId) => void;
};

const copy = strings.library.health;
const assist = strings.library.assist;

const CHECKS: readonly HealthCheckId[] = [
  "profile",
  "experience",
  "skills",
  "recentBullets",
  "goodBullets",
];

export function HealthCard({ health, onOpenField }: HealthCardProps) {
  const passed = new Set(health.passed);
  const missing = CHECKS.filter((id) => !passed.has(id));

  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium text-ink">{copy.title}</h2>
        <p className="text-sm text-slate tabular-nums">{copy.percent(health.percent)}</p>
      </div>
      <p className="mt-1 text-sm text-slate tabular-nums">
        {copy.strengthSummary(health.strongOrBetter, health.bulletCount)}
      </p>
      {health.missingProfile.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {health.missingProfile.map((field) => (
            <li key={field}>
              <button
                type="button"
                className="text-sm text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={() => onOpenField(field)}
              >
                {assist.missing[field]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {missing.some((id) => id !== "profile") ? (
        <ul className="mt-2 grid gap-1">
          {missing
            .filter((id) => id !== "profile")
            .map((id) => (
              <li key={id} className="text-sm text-slate">
                {strings.status.missing} · {copy.checks[id]}
              </li>
            ))}
        </ul>
      ) : null}
      {health.weakest.length > 0 ? (
        <p className="mt-2 text-sm text-slate">{assist.needsWork(health.weakest.length)}</p>
      ) : null}
      <p className="mt-2 text-xs text-slate">{assist.where}</p>
    </section>
  );
}
