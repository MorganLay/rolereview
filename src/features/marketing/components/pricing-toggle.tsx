"use client";

import { strings } from "@/copy/strings";
import { captureBrowserEvent } from "@/lib/analytics-browser";
import { cn } from "@/lib/utils";
import type { PricingInterval } from "@/features/marketing/present";

const copy = strings.marketing.home;

export function PricingToggle({
  interval,
  savePercent,
  label,
  onChange,
}: {
  interval: PricingInterval;
  savePercent: number | null;
  label: string;
  onChange: (next: PricingInterval) => void;
}) {
  function select(next: PricingInterval) {
    onChange(next);
    captureBrowserEvent("pricing_toggle", { interval: next });
  }

  return (
    <div
      className="inline-flex rounded-button border border-line bg-paper p-1"
      role="group"
      aria-label={label}
    >
      <ToggleButton pressed={interval === "MONTH"} onClick={() => select("MONTH")}>
        {copy.pricingMonthly}
      </ToggleButton>
      <ToggleButton
        pressed={interval === "QUARTER"}
        onClick={() => select("QUARTER")}
      >
        {copy.pricingQuarterly}
        {savePercent ? (
          <span className="ml-1 text-pine">{copy.pricingSave(savePercent)}</span>
        ) : null}
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "min-h-11 whitespace-nowrap rounded-button px-3 text-sm",
        pressed ? "bg-surface font-medium text-ink shadow-sm" : "text-slate",
      )}
    >
      {children}
    </button>
  );
}
