import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center sm:py-28">
        <p className="text-sm font-medium text-pine">
          {strings.marketing.home.eyebrow}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {strings.marketing.home.title}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate">
          {strings.marketing.home.body}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-in?next=/library/import">
              {strings.marketing.home.cta}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/sign-in">{strings.marketing.nav.signIn}</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-slate">
          {strings.marketing.home.microcopy}
        </p>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-16 border-t border-line bg-surface"
      >
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-serif text-2xl font-semibold text-ink">
            {strings.marketing.home.howItWorksTitle}
          </h2>
          <p className="mt-3 text-slate">
            {strings.marketing.home.howItWorksBody}
          </p>
        </div>
      </section>

      <section id="features" className="scroll-mt-16 border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-serif text-2xl font-semibold text-ink">
            {strings.marketing.home.featuresTitle}
          </h2>
          <p className="mt-3 text-slate">
            {strings.marketing.home.featuresBody}
          </p>
        </div>
      </section>
    </div>
  );
}
