import type { AllowanceCatalog, CheckoutPrices, TailorPillView } from "@/features/billing/present";
import { PaymentFailedBanner } from "@/features/billing/components/payment-failed-banner";
import { FeedbackProvider } from "@/features/growth/feedback/components/feedback-button";
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
  paymentFailed: boolean;
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
  paymentFailed,
  plan,
  children,
}: AppShellProps) {
  return (
    <FeedbackProvider>
      <div className="flex min-h-full w-full min-w-0 max-w-full bg-paper text-ink">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 border-r border-line bg-surface md:flex md:flex-col">
          <SidebarNav usage={usage} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader userEmail={userEmail} reminders={reminders} usage={usage} />
          <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">
            {paymentFailed ? (
              <div className="mb-4">
                <PaymentFailedBanner />
              </div>
            ) : null}
            {children}
          </main>
        </div>

        <UpgradeModal
          catalog={catalog}
          prices={prices}
          foundingEligible={foundingEligible}
          hasCustomer={hasCustomer}
          plan={plan}
        />
      </div>
    </FeedbackProvider>
  );
}
