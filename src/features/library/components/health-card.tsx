import { CheckIcon, XIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { strings } from "@/copy/strings";

import type { HealthCheckId, LibraryHealth } from "../health";

type HealthCardProps = {
  health: LibraryHealth;
};

const copy = strings.library.health;
const status = strings.status;

const CHECKS: readonly HealthCheckId[] = [
  "profile",
  "experience",
  "skills",
  "recentBullets",
  "goodBullets",
];

export function HealthCard({ health }: HealthCardProps) {
  const passed = new Set(health.passed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-ink">{copy.title}</CardTitle>
        <p className="text-sm text-slate tabular-nums">{copy.percent(health.percent)}</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Progress value={health.percent} aria-hidden />
        <ul className="grid gap-2">
          {CHECKS.map((id) => {
            const met = passed.has(id);
            return (
              <li key={id} className="flex items-start gap-2 text-sm">
                {met ? (
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-pine" aria-hidden />
                ) : (
                  <XIcon className="mt-0.5 size-4 shrink-0 text-clay" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="text-ink">{met ? status.met : status.missing}</span>
                  <span className="text-slate"> · {copy.checks[id]}</span>
                  {id === "recentBullets" ? (
                    <span className="mt-0.5 block text-xs text-slate">
                      {copy.checks.recentHint}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="grid gap-3 border-t border-line pt-4">
          <h3 className="text-sm font-medium text-ink">{copy.strengthTitle}</h3>
          <p className="text-sm text-slate tabular-nums">
            {copy.strengthSummary(health.strongOrBetter, health.bulletCount)}
          </p>
          {health.weakest.length > 0 ? (
            <div className="grid gap-3">
              <h4 className="text-sm font-medium text-ink">{copy.weakestTitle}</h4>
              <ul className="grid gap-3">
                {health.weakest.map((bullet) => (
                  <li key={bullet.id} className="grid gap-1 border-t border-line pt-3">
                    <p className="text-sm whitespace-pre-wrap text-ink">{bullet.text}</p>
                    <p className="text-xs text-slate">
                      {bullet.entryTitle} · {strings.strength[bullet.tier]}
                    </p>
                    {bullet.fix ? <p className="text-xs text-ink">{bullet.fix}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
