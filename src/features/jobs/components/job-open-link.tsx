"use client";

import Link, { useLinkStatus } from "next/link";

import { strings } from "@/copy/strings";
import { cn } from "@/lib/utils";

const copy = strings.jobs.board;

/** Name that says Opening… as soon as the job navigation starts. */
export function JobOpenLink({
  href,
  company,
  label,
  textClassName,
  className,
}: {
  href: string;
  company: string;
  /** Visible text. The company is used when this is omitted. */
  label?: string;
  textClassName?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={className}>
      <JobOpenLabel text={label ?? company} textClassName={textClassName} />
    </Link>
  );
}

function JobOpenLabel({
  text,
  textClassName,
}: {
  text: string;
  textClassName?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span className="flex min-w-0 flex-col" aria-busy={pending || undefined}>
      <span className={cn("break-words", textClassName)}>{text}</span>
      {pending ? (
        <span className="font-normal text-sm text-slate">{copy.opening}</span>
      ) : null}
    </span>
  );
}
