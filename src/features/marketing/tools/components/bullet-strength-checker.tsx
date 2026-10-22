"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { StrengthMeter } from "@/features/library/components/strength-meter";
import { bulletStrength } from "@/features/library/strength";
import { CtaLink } from "@/features/marketing/components/cta-link";
import { captureBrowserEvent } from "@/lib/analytics-browser";

import { parseBulletLines } from "../bullets";

const copy = strings.marketing.tools.bullets;

type CheckedBullets = {
  bullets: string[];
  extra: number;
};

export function BulletStrengthChecker() {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<CheckedBullets | null>(null);
  const [emptyError, setEmptyError] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseBulletLines(text);
    if (parsed.bullets.length === 0) {
      setChecked(null);
      setEmptyError(true);
      return;
    }
    setEmptyError(false);
    setChecked(parsed);
    captureBrowserEvent("tool_run", { tool: "bullet-strength" });
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="bullet-text">{copy.label}</Label>
          <Textarea
            id="bullet-text"
            name="bullets"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={copy.placeholder}
            className="min-h-48 text-sm"
            aria-invalid={emptyError}
          />
          {emptyError ? (
            <p className="text-sm text-clay">{copy.empty}</p>
          ) : null}
        </div>
        <Button type="submit" className="min-h-11">
          {copy.submit}
        </Button>
      </form>

      {checked ? <BulletResults result={checked} /> : null}
    </div>
  );
}

function BulletResults({ result }: { result: CheckedBullets }) {
  return (
    <div className="space-y-6">
      {result.extra > 0 ? (
        <p className="text-sm text-slate">{copy.extra(result.extra)}</p>
      ) : null}
      <ul className="space-y-4">
        {result.bullets.map((bullet, index) => {
          const strength = bulletStrength(bullet, []);
          return (
            <li
              key={`${index}-${bullet.slice(0, 24)}`}
              className="rounded-card border border-line bg-surface p-4"
            >
              <p className="text-sm text-ink">{bullet}</p>
              <div className="mt-3">
                <StrengthMeter text={bullet} skills={[]} />
              </div>
              {strength.fixes.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate">
                  {strength.fixes.map((fix) => (
                    <li key={fix}>{fix}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate">{copy.noFixes}</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="space-y-3">
        <p className="text-sm text-slate">{copy.ctaLead}</p>
        <CtaLink location="bullet-strength" compact />
      </div>
    </div>
  );
}
