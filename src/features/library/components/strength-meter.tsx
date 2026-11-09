"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { strings } from "@/copy/strings";
import { bulletStrength, filledSegments, type BulletRole } from "@/features/library/strength";
import { cn } from "@/lib/utils";

type StrengthMeterProps = {
  text: string;
  skills: readonly string[];
  role?: BulletRole;
};

const copy = strings.strength;
const SEGMENTS = 5;

export function StrengthMeter({ text, skills, role = "accomplishment" }: StrengthMeterProps) {
  const result = bulletStrength(text, skills, role);
  const filled = filledSegments(result.tier);
  const label = copy[result.tier];
  const detail = result.fixes.length > 0 ? result.fixes.join(" ") : copy.excellentNote;
  const quiet = result.tier === "strong" || result.tier === "excellent";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={copy.meterAria(label, detail)}
        >
          <span className="flex items-center gap-px" aria-hidden>
            {Array.from({ length: SEGMENTS }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1 w-2 rounded-[1px]",
                  index < filled
                    ? quiet
                      ? "bg-pine/65"
                      : "bg-marigold"
                    : "bg-foreground/10",
                )}
              />
            ))}
          </span>
          <span
            className={cn(
              "min-w-[3.75rem] text-[0.75rem] leading-none",
              quiet ? "text-slate/75" : "text-slate",
            )}
          >
            {label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-1">
        {role === "record" ? <p>{copy.recordNote}</p> : null}
        {result.fixes.length > 0 ? (
          <ul className="grid gap-1">
            {result.fixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ul>
        ) : (
          <p>{copy.excellentNote}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
