"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Wordmark } from "@/components/marketing/wordmark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { strings } from "@/copy/strings";
import { cn } from "@/lib/utils";

type NavItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "soon"; label: string };

const primaryNav: NavItem[] = [
  { kind: "link", href: "/#how-it-works", label: strings.marketing.nav.howItWorks },
  { kind: "link", href: "/#features", label: strings.marketing.nav.features },
  { kind: "soon", label: strings.marketing.nav.pricing },
  { kind: "soon", label: strings.marketing.nav.freeTools },
];

export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine"
          aria-label={strings.brand.name}
        >
          <Wordmark className="h-6" />
        </Link>

        <nav
          className="ml-2 hidden items-center gap-1 md:flex"
          aria-label={strings.marketing.nav.primary}
        >
          {primaryNav.map((item) =>
            item.kind === "link" ? (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-button px-2.5 py-1.5 text-sm text-slate transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                className="cursor-default rounded-button px-2.5 py-1.5 text-sm text-slate/60"
                title={strings.marketing.nav.comingSoon}
              >
                {item.label}
              </span>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/sign-in">{strings.marketing.nav.signIn}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-in?next=/library/import">
              {strings.marketing.nav.startFree}
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={strings.common.openMenu}
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100%,20rem)] bg-paper">
          <SheetHeader>
            <SheetTitle className="sr-only">{strings.marketing.nav.primary}</SheetTitle>
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="inline-flex w-fit"
              aria-label={strings.brand.name}
            >
              <Wordmark className="h-6" />
            </Link>
          </SheetHeader>
          <nav
            className="mt-6 flex flex-col gap-1"
            aria-label={strings.marketing.nav.primary}
          >
            {primaryNav.map((item) =>
              item.kind === "link" ? (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-button px-3 py-2.5 text-base text-ink hover:bg-pine-50",
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.label}
                  className="rounded-button px-3 py-2.5 text-base text-slate/60"
                  title={strings.marketing.nav.comingSoon}
                >
                  {item.label}
                </span>
              ),
            )}
            <Link
              href="/sign-in"
              onClick={() => setMobileOpen(false)}
              className="rounded-button px-3 py-2.5 text-base text-ink hover:bg-pine-50 sm:hidden"
            >
              {strings.marketing.nav.signIn}
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
