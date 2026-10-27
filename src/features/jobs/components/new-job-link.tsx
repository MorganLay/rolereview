"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

let nextJobForm = 0;
const visitListeners = new Set<() => void>();

/** The open new-job form subscribes so a click can clear a preserved draft. */
export function subscribeNewJobVisit(onChange: () => void): () => void {
  visitListeners.add(onChange);
  return () => {
    visitListeners.delete(onChange);
  };
}

function startNewJobVisit(): number {
  nextJobForm += 1;
  for (const listener of visitListeners) listener();
  return nextJobForm;
}

/**
 * Opens a blank new-job form. The query changes the page key, and the visit
 * signal clears a form the app router kept mounted on "Analyzing the posting".
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
    const id = startNewJobVisit();
    router.push(`/jobs/new?new=${id}`);
  }

  return (
    <Link href="/jobs/new" className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
