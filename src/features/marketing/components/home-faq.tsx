"use client";

import { strings } from "@/copy/strings";
import { captureBrowserEvent } from "@/lib/analytics-browser";
import type { FaqItem } from "@/features/marketing/faq";

const copy = strings.marketing.home;

export function HomeFaq({ items }: { items: readonly FaqItem[] }) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink">
        {copy.faqTitle}
      </h2>
      <div className="mt-6 divide-y divide-line border-y border-line">
        {items.map((item) => (
          <details
            key={item.id}
            className="group py-1"
            onToggle={(event) => {
              if (event.currentTarget.open) {
                captureBrowserEvent("faq_open", { q: item.id });
              }
            }}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-left text-base font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
              {item.question}
              <span
                aria-hidden
                className="text-slate transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-slate">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
