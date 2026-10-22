import { notFound } from "next/navigation";

import { SettingsScreen } from "@/features/billing/components/settings-screen";
import { parseSettingsTab } from "@/features/billing/present";
import { getPlanBilling } from "@/features/billing/queries";
import { requireUser } from "@/lib/auth";

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

  return <SettingsScreen tab={tab} billing={billing} />;
}
