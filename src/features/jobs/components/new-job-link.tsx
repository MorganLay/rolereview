"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

let nextJobForm = 0;

/**
 * Opens a blank new-job form. A fresh query avoids restoring the
 * previous "Analyzing the posting" screen.
 */
export function NewJobLink({
  className,
  children,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href">) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    nextJobForm += 1;
    router.push(`/jobs/new?new=${nextJobForm}`);
  }

  return (
    <Link href="/jobs/new" className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
