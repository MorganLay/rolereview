import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { strings } from "@/copy/strings";

import type { InsightsData } from "../queries";
import { presentInsights, type FunnelRow, type WeekRow, type WorkingRow } from "../present";
import { BreakdownChart } from "./breakdown-chart";
import { FunnelChart } from "./funnel-chart";
import { InsightsRangeControl } from "./insights-range";
import { WeeklyChart } from "./weekly-chart";
import { WhatsWorkingPreview } from "./whats-working-preview";

const copy = strings.insights;
const page = strings.pages.insights;

export function InsightsScreen({ data, pro }: { data: InsightsData; pro: boolean }) {
  const view = presentInsights(data);
  const saved = view.funnel[0]?.count ?? 0;
  const showCharts = data.everApplied && (data.applied > 0 || saved > 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {page.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate">{page.body}</p>
      </div>
      <InsightsRangeControl range={data.range} />
      {data.everApplied ? (
        <>
          <KpiTiles tiles={view.kpis} />
          {showCharts ? (
            <>
              <FunnelSection rows={view.funnel} />
              {view.weeks.length > 0 ? <WeeklySection weeks={view.weeks} /> : null}
            </>
          ) : (
            <p className="text-sm text-slate">{copy.rangeEmpty}</p>
          )}
        </>
      ) : (
        <EmptyState />
      )}
      {pro ? <WhatsWorking groups={view.working} /> : <WhatsWorkingPreview />}
    </div>
  );
}

function KpiTiles({ tiles }: { tiles: ReturnType<typeof presentInsights>["kpis"] }) {
  return (
    <dl aria-label={copy.summary} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-line px-3 py-3">
          <dt className="text-sm text-slate">{tile.label}</dt>
          <dd className="mt-1 text-2xl font-medium text-ink tabular-nums">{tile.value}</dd>
          {tile.detail ? (
            <dd className="text-sm text-slate tabular-nums">{tile.detail}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

function FunnelSection({ rows }: { rows: readonly FunnelRow[] }) {
  return (
    <section aria-labelledby="funnel-heading" className="flex flex-col gap-3">
      <h2 id="funnel-heading" className="text-base font-medium text-ink">
        {copy.funnel}
      </h2>
      <ol aria-label={copy.funnel} className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="w-28 text-sm text-ink">{row.label}</span>
            <span className="text-sm font-medium text-ink tabular-nums">{row.count}</span>
            {row.conversion ? <span className="text-sm text-slate">{row.conversion}</span> : null}
          </li>
        ))}
      </ol>
      <div aria-hidden>
        <FunnelChart rows={rows} />
      </div>
    </section>
  );
}

function WeeklySection({ weeks }: { weeks: readonly WeekRow[] }) {
  return (
    <section aria-labelledby="weekly-heading" className="flex flex-col gap-3">
      <h2 id="weekly-heading" className="text-base font-medium text-ink">
        {copy.weekly}
      </h2>
      <div className="overflow-x-auto">
        <WeeklyChart weeks={weeks} />
      </div>
    </section>
  );
}

function WhatsWorking({
  groups,
}: {
  groups: ReturnType<typeof presentInsights>["working"];
}) {
  const sections = [
    { title: copy.bySource, rows: groups.source },
    { title: copy.byMatch, rows: groups.band },
    { title: copy.tailoredVsNot, rows: groups.tailored },
  ];

  return (
    <section aria-labelledby="working-heading" className="flex flex-col gap-6">
      <div>
        <h2 id="working-heading" className="text-base font-medium text-ink">
          {copy.whatsWorking}
        </h2>
        <p className="mt-1 text-sm text-slate">{copy.interviewRateShort}</p>
      </div>
      {sections.map((section) => (
        <Breakdown key={section.title} title={section.title} rows={section.rows} />
      ))}
    </section>
  );
}

function Breakdown({ title, rows }: { title: string; rows: readonly WorkingRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate">{copy.smallSample}</p>
      ) : (
        <>
          <ul aria-label={title} className="flex flex-col gap-1">
            {rows.map((row) => (
              <li key={row.key} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="text-ink">{row.label}</span>
                <span className="font-medium text-ink tabular-nums">{row.rate}</span>
                <span className="text-slate">{row.sample}</span>
              </li>
            ))}
          </ul>
          <div aria-hidden>
            <BreakdownChart rows={rows} />
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-slate">{copy.empty}</p>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/jobs">{copy.goToJobs}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
