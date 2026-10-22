"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { strings } from "@/copy/strings";

import type { WorkingRow } from "../present";
import { useReducedMotion } from "./use-reduced-motion";

const copy = strings.insights;

const config = {
  percent: { label: copy.interviewRateShort, color: "var(--chart-1)" },
} satisfies ChartConfig;

export function BreakdownChart({ rows }: { rows: readonly WorkingRow[] }) {
  const reduced = useReducedMotion();
  const height = Math.max(96, rows.length * 44);

  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height }}
      initialDimension={{ width: 320, height }}
    >
      <BarChart
        accessibilityLayer={false}
        data={rows.map((row) => ({
          label: row.label,
          percent: row.percent,
          rate: row.rate,
        }))}
        layout="vertical"
        margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
      >
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={112}
        />
        <Bar
          dataKey="percent"
          fill="var(--color-percent)"
          radius={4}
          maxBarSize={28}
          isAnimationActive={!reduced}
        >
          <LabelList
            dataKey="rate"
            position="right"
            fill="var(--foreground)"
            className="text-xs"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
