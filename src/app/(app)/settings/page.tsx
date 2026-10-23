import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { strings } from "@/copy/strings";

import { checkoutPrices } from "@/features/billing/catalog";
import { previewAllowed } from "@/features/billing/checkout-rules";
import { SettingsScreen } from "@/features/billing/components/settings-screen";
import { checkoutConfirmed, parseSettingsTab } from "@/features/billing/present";
import { getPlanBilling } from "@/features/billing/queries";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: strings.pages.settings.title,
  description: strings.pages.settings.body,
};

/** Usage is read for the signed-in user, including "now". */
export const instant = false;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = parseSettingsTab(params.tab);
  const billing = tab === "plan" ? await getPlanBilling(user.id) : null;
  if (tab === "plan" && !billing) notFound();

  return (
    <SettingsScreen
      tab={tab}
      billing={billing}
      prices={checkoutPrices()}
      upgraded={tab === "plan" && checkoutConfirmed(params.upgraded)}
      showTestPreview={previewAllowed(env.NODE_ENV, env.STRIPE_SECRET_KEY ?? null)}
    />
  );
}
