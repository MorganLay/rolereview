"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { strings } from "@/copy/strings";

import type { WeekRow } from "../present";
import { useReducedMotion } from "./use-reduced-motion";

const copy = strings.insights;

const config = {
  tailored: { label: copy.tailored, color: "var(--chart-1)" },
  notTailored: { label: copy.notTailored, color: "var(--chart-2)" },
} satisfies ChartConfig;

export function WeeklyChart({ weeks }: { weeks: readonly WeekRow[] }) {
  const reduced = useReducedMotion();
  const minWidth = Math.max(320, weeks.length * 52);

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-64 w-full"
      style={{ minWidth }}
      initialDimension={{ width: minWidth, height: 256 }}
    >
      <BarChart
        data={weeks.map((week) => ({
          label: week.label,
          tailored: week.tailored,
          notTailored: week.notTailored,
        }))}
        margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
      >
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="tailored"
          stackId="week"
          fill="var(--color-tailored)"
          maxBarSize={36}
          isAnimationActive={!reduced}
        />
        <Bar
          dataKey="notTailored"
          stackId="week"
          fill="var(--color-notTailored)"
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
          isAnimationActive={!reduced}
        />
      </BarChart>
    </ChartContainer>
  );
}
