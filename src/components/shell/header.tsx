"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Menu, Plus, UserRound } from "lucide-react";

import { signOut } from "@/features/account/actions";
import { useOpenFeedback } from "@/features/growth/feedback/components/feedback-button";
import { NewJobLink } from "@/features/jobs/components/new-job-link";
import { RemindersBell } from "@/features/tracking/components/reminders-bell";
import type { ReminderView } from "@/features/tracking/reminders";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { strings } from "@/copy/strings";
import type { TailorPillView } from "@/features/billing/present";

import { SidebarNav } from "./sidebar-nav";

type AppHeaderProps = {
  userEmail: string;
  reminders: ReminderView[];
  usage: TailorPillView;
};

export function AppHeader({ userEmail, reminders, usage }: AppHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutPending, startSignOut] = useTransition();
  const openFeedback = useOpenFeedback();

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-2 border-b border-line bg-paper/95 px-3 backdrop-blur-sm md:px-6">
      <div className="flex min-w-0 items-center gap-1 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={strings.common.openMenu}
          onClick={() => setMobileOpen(true)}
        >
          <Menu />
        </Button>
        <Link
          href="/dashboard"
          className="min-w-0 truncate font-serif text-base font-semibold tracking-tight text-ink"
        >
          {strings.brand.name}
        </Link>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100%,18rem)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{strings.nav.mainNav}</SheetTitle>
          </SheetHeader>
          <SidebarNav usage={usage} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button type="button" size="sm" asChild>
          <NewJobLink>
            <Plus data-icon="inline-start" />
            <span className="hidden sm:inline">{strings.actions.newJob}</span>
            <span className="sm:hidden">{strings.actions.addJob}</span>
          </NewJobLink>
        </Button>

        <RemindersBell reminders={reminders} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={strings.shell.userMenuAria}
            >
              <UserRound aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal break-all whitespace-normal text-slate">
              {userEmail}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="md:hidden" onSelect={() => openFeedback()}>
              {strings.feedback.button}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={signOutPending}
              onSelect={() => {
                startSignOut(() => {
                  void signOut();
                });
              }}
            >
              {signOutPending ? strings.common.loading : strings.auth.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
