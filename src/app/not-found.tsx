import type { Metadata } from "next";
import Link from "next/link";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { ProblemPage } from "@/components/shell/problem-page";
import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

const copy = strings.errors.notFound;

export const metadata: Metadata = {
  title: copy.title,
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <MarketingHeader />
      <main className="flex flex-1 flex-col">
        <ProblemPage
          title={copy.title}
          body={copy.body}
          actions={
            <Button asChild className="min-h-11">
              <Link href="/">{copy.home}</Link>
            </Button>
          }
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
