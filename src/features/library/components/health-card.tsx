import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

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
                {health.weakest.map((bullet) => {
                  const more = bullet.fixes.slice(1);
                  return (
                    <li key={bullet.id} className="border-t border-line pt-3">
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-start gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm whitespace-pre-wrap text-ink">
                              {bullet.text}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate">
                              {bullet.entryTitle} · {strings.strength[bullet.tier]}
                            </span>
                            {bullet.fix ? (
                              <span className="mt-1 block text-xs text-ink">{bullet.fix}</span>
                            ) : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-pine">
                            <span className="group-open:hidden">{copy.expand}</span>
                            <span className="hidden group-open:inline">{copy.collapse}</span>
                            <ChevronDownIcon
                              className="size-3.5 motion-safe:transition-transform group-open:rotate-180"
                              aria-hidden
                            />
                          </span>
                        </summary>
                        <div className="mt-2 grid gap-2">
                          {more.length > 0 ? (
                            <ul className="grid gap-1">
                              {more.map((fix) => (
                                <li key={fix} className="text-xs text-ink">
                                  {fix}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {bullet.example ? (
                            <div className="grid gap-1">
                              <p className="text-xs font-medium text-ink">
                                {strings.strength.exampleLead}
                              </p>
                              <p className="text-sm whitespace-pre-wrap text-ink">
                                {bullet.example}
                              </p>
                              <p className="text-xs text-slate">{strings.strength.exampleNote}</p>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
