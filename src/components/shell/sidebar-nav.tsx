"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { strings } from "@/copy/strings";
import { cn } from "@/lib/utils";

import type { TailorPillView } from "@/features/billing/present";
import { FeedbackSidebarButton } from "@/features/growth/feedback/components/feedback-button";

import { APP_NAV_ITEMS, isNavActive } from "./nav-items";
import { UsagePill } from "./usage-pill";

type SidebarNavProps = {
  usage: TailorPillView;
  onNavigate?: () => void;
  className?: string;
};

export function SidebarNav({ usage, onNavigate, className }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col", className)}>
      <div className="px-4 py-5">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="font-serif text-lg font-semibold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine"
        >
          {strings.brand.name}
        </Link>
      </div>

      <nav
        aria-label={strings.nav.mainNav}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2"
      >
        {APP_NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine",
                active
                  ? "bg-pine-50 text-pine-hover"
                  : "text-slate hover:bg-pine-50/60 hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line p-3">
        <FeedbackSidebarButton />
        <UsagePill usage={usage} />
      </div>
    </div>
  );
}
