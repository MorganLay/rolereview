"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";

import { Wordmark } from "@/components/marketing/wordmark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { strings } from "@/copy/strings";
import { CtaLink } from "@/features/marketing/components/cta-link";
import { useSignedIn } from "@/features/marketing/use-signed-in";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#how-it-works", label: strings.marketing.nav.howItWorks },
  { href: "/#features", label: strings.marketing.nav.features },
  { href: "/pricing", label: strings.marketing.nav.pricing },
] as const;

const freeTools = [
  strings.marketing.footer.atsChecker,
  strings.marketing.footer.bulletStrength,
] as const;

export function MarketingHeader() {
  const signedIn = useSignedIn();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine"
          aria-label={strings.brand.name}
        >
          <Wordmark className="h-6" />
        </Link>

        <nav
          className="ml-1 hidden items-center gap-1 md:flex"
          aria-label={strings.marketing.nav.primary}
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-button px-2.5 py-1.5 text-sm text-slate transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex min-h-11 items-center gap-1 rounded-button px-2.5 text-sm text-slate hover:text-ink">
              {strings.marketing.nav.freeTools}
              <ChevronDown className="size-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {freeTools.map((label) => (
                <DropdownMenuItem key={label} disabled title={strings.marketing.nav.comingSoon}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? null : (
            <Button asChild variant="ghost" className="hidden min-h-11 sm:inline-flex">
              <Link href="/sign-in">{strings.marketing.nav.signIn}</Link>
            </Button>
          )}
          <CtaLink location="header" compact />
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
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-button px-3 py-2.5 text-base text-ink hover:bg-pine-50"
              >
                {item.label}
              </Link>
            ))}
            <p className="px-3 pt-3 text-xs font-medium uppercase tracking-wide text-slate">
              {strings.marketing.nav.freeTools}
            </p>
            {freeTools.map((label) => (
              <span
                key={label}
                className="rounded-button px-3 py-2.5 text-base text-slate/60"
                title={strings.marketing.nav.comingSoon}
              >
                {label}
              </span>
            ))}
            {signedIn ? null : (
              <Link
                href="/sign-in"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-button px-3 py-2.5 text-base text-ink hover:bg-pine-50 sm:hidden",
                )}
              >
                {strings.marketing.nav.signIn}
              </Link>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
