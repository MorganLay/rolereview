import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { strings } from "@/copy/strings";

import { checkoutPrices } from "@/features/billing/catalog";
import { previewAllowed } from "@/features/billing/checkout-rules";
import { SettingsScreen } from "@/features/billing/components/settings-screen";
import { checkoutConfirmed, parseSettingsTab } from "@/features/billing/present";
import { getPlanBilling } from "@/features/billing/queries";
import { getPreferences } from "@/features/account/queries";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: strings.pages.settings.title,
  description: strings.pages.settings.body,
};

/** Usage and saved preferences are read for the signed-in user, including "now". */
export const instant = false;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await requireUser();
  const params = await searchParams;
  const tab = parseSettingsTab(params.tab);
  const billing = tab === "plan" ? await getPlanBilling(user.id) : null;
  if (tab === "plan" && !billing) notFound();
  const preferences = tab === "preferences" ? await getPreferences(user.id) : null;
  if (tab === "preferences" && !preferences) notFound();

  return (
    <SettingsScreen
      tab={tab}
      billing={billing}
      preferences={preferences}
      prices={checkoutPrices()}
      upgraded={tab === "plan" && checkoutConfirmed(params.upgraded)}
      showTestPreview={previewAllowed(env.NODE_ENV, env.STRIPE_SECRET_KEY ?? null)}
    />
  );
}
