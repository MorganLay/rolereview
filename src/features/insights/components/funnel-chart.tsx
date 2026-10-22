"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { strings } from "@/copy/strings";

import type { FunnelRow } from "../present";
import { useReducedMotion } from "./use-reduced-motion";

const copy = strings.insights;

const config = {
  count: { label: copy.funnel, color: "var(--chart-1)" },
} satisfies ChartConfig;

export function FunnelChart({ rows }: { rows: readonly FunnelRow[] }) {
  const reduced = useReducedMotion();
  const height = Math.max(180, rows.length * 36);

  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height }}
      initialDimension={{ width: 320, height }}
    >
      <BarChart
        accessibilityLayer={false}
        data={rows.map((row) => ({ label: row.label, count: row.count }))}
        layout="vertical"
        margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={104}
        />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={4}
          maxBarSize={28}
          isAnimationActive={!reduced}
        >
          <LabelList
            dataKey="count"
            position="right"
            fill="var(--foreground)"
            className="text-xs"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
