"use client";

import { useId, type ReactNode } from "react";

/** Collapsed excluded entries or skills. Expanding shows the include control. */
export function ExcludedGroup({
  count,
  label,
  open,
  onOpenChange,
  children,
}: {
  count: number;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const panelId = useId();
  if (count === 0) return null;

  return (
    <div className="grid min-w-0 gap-3">
      <button
        type="button"
        className="w-fit max-w-full rounded-md text-left text-sm text-slate underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
        {label}
      </button>
      {open ? (
        <div id={panelId} className="grid min-w-0 gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
