import { FeedbackButton } from "@/features/growth/feedback/components/feedback-button";

import { AppHeader } from "./header";
import { SidebarNav } from "./sidebar-nav";
import { UpgradeModal } from "./upgrade-modal";

type AppShellProps = {
  userEmail: string;
  children: React.ReactNode;
};

export function AppShell({ userEmail, children }: AppShellProps) {
  return (
    <div className="flex min-h-full bg-paper text-ink">
      <aside className="hidden w-56 shrink-0 border-r border-line bg-surface md:flex md:flex-col">
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader userEmail={userEmail} />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>

      <FeedbackButton />
      <UpgradeModal />
    </div>
  );
}
