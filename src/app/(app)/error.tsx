"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ProblemPage } from "@/components/shell/problem-page";
import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

const copy = strings.errors.unexpected;

export default function AppErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app error", { digest: error.digest });
  }, [error.digest]);

  return (
    <ProblemPage
      title={copy.title}
      body={copy.body}
      actions={
        <>
          <Button type="button" className="min-h-11" onClick={reset}>
            {copy.retry}
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/dashboard">{copy.dashboard}</Link>
          </Button>
        </>
      }
    />
  );
}
