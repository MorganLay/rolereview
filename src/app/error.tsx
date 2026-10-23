"use client";

import { useEffect } from "react";
import Link from "next/link";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { ProblemPage } from "@/components/shell/problem-page";
import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

const copy = strings.errors.unexpected;

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route error", { digest: error.digest });
  }, [error.digest]);

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <MarketingHeader />
      <main className="flex flex-1 flex-col">
        <ProblemPage
          title={copy.title}
          body={copy.body}
          actions={
            <>
              <Button type="button" className="min-h-11" onClick={reset}>
                {copy.retry}
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/">{copy.home}</Link>
              </Button>
            </>
          }
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
