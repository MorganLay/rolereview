import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { strings } from "@/copy/strings";
import { DataPanel } from "@/features/account/components/data-panel";
import { PreferencesForm } from "@/features/account/components/preferences-form";
import type { AccountPreferences } from "@/features/account/preferences";

import type { PlanBilling } from "../queries";
import { CheckoutActions } from "./checkout-actions";
import { PlanUpgradeButton } from "./plan-upgrade-button";
import {
  SETTINGS_TABS,
  presentPlanSummary,
  presentUsageRow,
  settingsHref,
  type CheckoutPrices,
  type SettingsTab,
} from "../present";

const copy = strings.billing;
const page = strings.pages.settings;

export function SettingsScreen({
  tab,
  billing,
  preferences,
  prices,
  upgraded,
  showTestPreview,
}: {
  tab: SettingsTab;
  billing: PlanBilling | null;
  preferences: AccountPreferences | null;
  prices: CheckoutPrices;
  upgraded: boolean;
  showTestPreview: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {page.title}
        </h1>
        <p className="mt-2 text-sm text-slate">{page.body}</p>
      </div>
      <nav aria-label={copy.tabsLabel} className="flex flex-wrap gap-1">
        {SETTINGS_TABS.map((key) => (
          <Button
            key={key}
            variant={tab === key ? "default" : "ghost"}
            size="sm"
            asChild
          >
            <Link href={settingsHref(key)} aria-current={tab === key ? "page" : undefined}>
              {copy.tabs[key]}
            </Link>
          </Button>
        ))}
      </nav>
      {tab === "plan" && billing ? (
        <PlanPanel
          billing={billing}
          prices={prices}
          upgraded={upgraded}
          showTestPreview={showTestPreview}
        />
      ) : tab === "preferences" && preferences ? (
        <PreferencesForm preferences={preferences} />
      ) : tab === "data" ? (
        <DataPanel />
      ) : (
        <Later />
      )}
    </div>
  );
}

function PlanPanel({
  billing,
  prices,
  upgraded,
  showTestPreview,
}: {
  billing: PlanBilling;
  prices: CheckoutPrices;
  upgraded: boolean;
  showTestPreview: boolean;
}) {
  const summary = presentPlanSummary({
    plan: billing.plan,
    billingInterval: billing.billingInterval,
    currentPeriodEnd: billing.currentPeriodEnd,
    cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
    foundingMember: billing.foundingMember,
    timeZone: billing.timeZone,
  });
  const rows = billing.usage.map(presentUsageRow);

  return (
    <div className="flex flex-col gap-8">
      {upgraded ? (
        <p
          role="status"
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          {copy.confirmed}
        </p>
      ) : null}
      <section aria-labelledby="plan-heading" className="flex flex-col gap-3">
        <h2 id="plan-heading" className="text-base font-medium text-ink">
          {copy.planHeading}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-ink">{summary.plan}</p>
          {summary.founding ? (
            <Badge variant="outline">{summary.founding}</Badge>
          ) : null}
        </div>
        {summary.interval ? <p className="text-sm text-slate">{summary.interval}</p> : null}
        {summary.renewal ? (
          <p className="text-sm tabular-nums text-slate">{summary.renewal}</p>
        ) : null}
        {billing.plan === "FREE" ? (
          <div>
            <PlanUpgradeButton />
          </div>
        ) : null}
        <CheckoutActions
          prices={prices}
          foundingEligible={billing.foundingEligible}
          hasCustomer={billing.hasCustomer}
          plan={billing.plan}
          showTestPreview={showTestPreview}
        />
      </section>
      <section aria-labelledby="usage-heading" className="flex flex-col gap-4">
        <h2 id="usage-heading" className="text-base font-medium text-ink">
          {copy.usage}
        </h2>
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.meter} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink">{row.label}</span>
                <span className="text-sm font-medium text-ink tabular-nums">{row.count}</span>
              </div>
              <p className="text-xs text-slate">{row.period}</p>
              <Progress value={row.percent} aria-label={row.aria} />
              {row.bonus ? (
                <p className="text-sm text-slate tabular-nums">{row.bonus}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Later() {
  return <p className="text-sm text-slate">{strings.shell.placeholderBody}</p>;
}
