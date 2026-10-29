"use client";

import Link, { useLinkStatus } from "next/link";

import { strings } from "@/copy/strings";

const copy = strings.jobs.board;

/** Company name that says Opening… as soon as the job navigation starts. */
export function JobOpenLink({
  href,
  company,
  className,
}: {
  href: string;
  company: string;
  className?: string;
}) {
  return (
    <Link href={href} className={className}>
      <JobOpenLabel company={company} />
    </Link>
  );
}

function JobOpenLabel({ company }: { company: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className="flex min-w-0 flex-col" aria-busy={pending || undefined}>
      <span className="break-words">{company}</span>
      {pending ? (
        <span className="font-normal text-sm text-slate">{copy.opening}</span>
      ) : null}
    </span>
  );
}
