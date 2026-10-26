"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { strings } from "@/copy/strings";
import { bulletStrength, filledSegments } from "@/features/library/strength";
import { cn } from "@/lib/utils";

type StrengthMeterProps = {
  text: string;
  skills: readonly string[];
};

const copy = strings.strength;
const SEGMENTS = 5;

export function StrengthMeter({ text, skills }: StrengthMeterProps) {
  const result = bulletStrength(text, skills);
  const filled = filledSegments(result.tier);
  const label = copy[result.tier];
  const detail =
    result.fixes.length > 0 ? result.fixes.join(" ") : copy.excellentNote;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex w-fit shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={copy.meterAria(label, detail)}
        >
          <span className="flex gap-0.5" aria-hidden>
            {Array.from({ length: SEGMENTS }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 w-3 rounded-sm",
                  index < filled ? "bg-marigold" : "bg-foreground/15",
                )}
              />
            ))}
          </span>
          <span className="text-xs text-slate">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-1">
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
