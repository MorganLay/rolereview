import type { Metadata } from "next";
import Link from "next/link";

import { ProblemPage } from "@/components/shell/problem-page";
import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

const copy = strings.errors.notFound;

export const metadata: Metadata = {
  title: copy.title,
};

export default function AppNotFound() {
  return (
    <ProblemPage
      title={copy.title}
      body={copy.body}
      actions={
        <Button asChild className="min-h-11">
          <Link href="/dashboard">{copy.dashboard}</Link>
        </Button>
      }
    />
  );
}
