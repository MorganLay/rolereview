import type { AllowanceCatalog, CheckoutPrices, TailorPillView } from "@/features/billing/present";
import { FeedbackButton } from "@/features/growth/feedback/components/feedback-button";
import type { ReminderView } from "@/features/tracking/reminders";

import { AppHeader } from "./header";
import { SidebarNav } from "./sidebar-nav";
import { UpgradeModal } from "./upgrade-modal";

type AppShellProps = {
  userEmail: string;
  reminders: ReminderView[];
  usage: TailorPillView;
  catalog: AllowanceCatalog;
  prices: CheckoutPrices;
  foundingEligible: boolean;
  hasCustomer: boolean;
  plan: "FREE" | "PRO";
  children: React.ReactNode;
};

export function AppShell({
  userEmail,
  reminders,
  usage,
  catalog,
  prices,
  foundingEligible,
  hasCustomer,
  plan,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-full bg-paper text-ink">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 border-r border-line bg-surface md:flex md:flex-col">
        <SidebarNav usage={usage} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader userEmail={userEmail} reminders={reminders} usage={usage} />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>

      <FeedbackButton />
      <UpgradeModal
        catalog={catalog}
        prices={prices}
        foundingEligible={foundingEligible}
        hasCustomer={hasCustomer}
        plan={plan}
      />
    </div>
  );
}
