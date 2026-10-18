import { Check } from "lucide-react";

import { WaitlistForm } from "@/features/growth/leads/components/waitlist-form";
import { strings } from "@/copy/strings";
import { env } from "@/lib/env";

const benefits = [
  {
    title: strings.marketing.waitlist.benefit1Title,
    body: strings.marketing.waitlist.benefit1Body,
  },
  {
    title: strings.marketing.waitlist.benefit2Title,
    body: strings.marketing.waitlist.benefit2Body,
  },
  {
    title: strings.marketing.waitlist.benefit3Title,
    body: strings.marketing.waitlist.benefit3Body,
  },
] as const;

export function WaitlistPage() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-12 px-6 py-16 sm:py-24 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
        <div className="max-w-xl flex-1 text-center lg:text-left">
          <p className="text-sm font-medium text-pine">
            {strings.marketing.waitlist.eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {strings.marketing.waitlist.title}
          </h1>
          <p className="mt-4 text-lg text-slate">
            {strings.marketing.waitlist.body}
          </p>
          <p className="mt-4 rounded-card border border-marigold-100 bg-marigold-100/60 px-4 py-3 text-sm text-ink">
            {strings.marketing.waitlist.foundingOffer}
          </p>

          <ul className="mt-8 space-y-4 text-left">
            {benefits.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-pine-50 text-pine">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="text-sm text-slate">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <div
            className="flex aspect-video w-full items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 text-center"
            role="img"
            aria-label={strings.marketing.waitlist.demoPlaceholder}
          >
            <div>
              <p className="font-medium text-ink">
                {strings.marketing.waitlist.demoPlaceholder}
              </p>
              <p className="mt-1 text-sm text-slate">
                {strings.marketing.waitlist.demoCaption}
              </p>
            </div>
          </div>
          <WaitlistForm appUrl={env.NEXT_PUBLIC_APP_URL} />
        </div>
      </section>
    </div>
  );
}
