import { can } from "@/features/billing/entitlements";
import { InsightsScreen } from "@/features/insights/components/insights-screen";
import { parseInsightsRange } from "@/features/insights/metrics";
import { getInsights } from "@/features/insights/queries";
import { requireUser } from "@/lib/auth";

/** The page is read for the signed-in user, including "now". */
export const instant = false;

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const data = await getInsights(user.id, parseInsightsRange(params.range));

  return <InsightsScreen data={data} pro={can(user, "insights:whats-working")} />;
}
