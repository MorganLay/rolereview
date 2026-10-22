"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { captureBrowserEvent } from "@/lib/analytics-browser";
import { cn } from "@/lib/utils";
import { primaryCta, type CtaLocation } from "@/features/marketing/cta";
import { useSignedIn } from "@/features/marketing/use-signed-in";

export function CtaLink({
  location,
  compact = false,
  variant = "default",
  className,
}: {
  location: CtaLocation;
  compact?: boolean;
  variant?: "default" | "outline";
  className?: string;
}) {
  const signedIn = useSignedIn();
  const cta = primaryCta(signedIn, compact);

  return (
    <Button asChild variant={variant} className={cn("min-h-11 px-4", className)}>
      <Link
        href={cta.href}
        onClick={() => captureBrowserEvent("cta_click", { location })}
      >
        {cta.label}
      </Link>
    </Button>
  );
}
