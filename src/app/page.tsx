import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-paper px-6 py-24 text-ink">
      <main className="flex max-w-lg flex-col items-center gap-6 text-center">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          {strings.home.title}
        </h1>
        <p className="text-lg text-slate">{strings.home.body}</p>
        <Button asChild>
          <Link href="/styleguide">{strings.home.styleguideLink}</Link>
        </Button>
      </main>
    </div>
  );
}
