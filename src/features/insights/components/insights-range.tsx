import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

import { INSIGHTS_RANGES, type InsightsRange } from "../metrics";

const copy = strings.insights;

export function insightsHref(range: InsightsRange): string {
  if (range === "30d") return "/insights";
  return `/insights?range=${range}`;
}

export function InsightsRangeControl({ range }: { range: InsightsRange }) {
  return (
    <div
      role="group"
      aria-label={copy.rangeLabel}
      className="inline-flex w-fit flex-wrap rounded-lg border border-border p-0.5"
    >
      {INSIGHTS_RANGES.map((key) => (
        <Button
          key={key}
          variant={range === key ? "default" : "ghost"}
          size="sm"
          asChild
        >
          <Link
            href={insightsHref(key)}
            aria-current={range === key ? "page" : undefined}
          >
            {copy.ranges[key]}
          </Link>
        </Button>
      ))}
    </div>
  );
}
