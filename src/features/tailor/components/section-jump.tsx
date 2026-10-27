"use client";

import { Button } from "@/components/ui/button";

/** Scrolls inside itself so a narrow page does not scroll sideways. */
export function SectionJump({
  label,
  targets,
  onJump,
}: {
  label: string;
  targets: readonly { id: string; label: string }[];
  onJump: (id: string) => void;
}) {
  return (
    <nav aria-label={label} className="min-w-0 max-w-full overflow-x-auto">
      <div className="flex w-max gap-2 py-1">
        {targets.map((target) => (
          <Button
            key={target.id}
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => onJump(target.id)}
          >
            {target.label}
          </Button>
        ))}
      </div>
    </nav>
  );
}
