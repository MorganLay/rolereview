import Link from "next/link";

import { strings } from "@/copy/strings";

type LegalSection = {
  heading: string;
  paragraphs: readonly string[];
};

export function LegalDocument({
  title,
  updated,
  note,
  contactLabel,
  sections,
}: {
  title: string;
  updated: string;
  note: string;
  contactLabel: string;
  sections: readonly LegalSection[];
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-3 text-sm text-slate">{updated}</p>
      <p className="mt-4 text-sm leading-relaxed text-slate">{note}</p>
      {sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink">
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-base leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <p className="mt-10">
        <Link href="/about#contact" className="text-sm text-pine underline-offset-4 hover:underline">
          {contactLabel}
        </Link>
      </p>
    </article>
  );
}

export function PrivacyPage() {
  const copy = strings.marketing.privacy;
  return (
    <LegalDocument
      title={copy.title}
      updated={copy.updated}
      note={copy.note}
      contactLabel={copy.contactLabel}
      sections={copy.sections}
    />
  );
}

export function TermsPage() {
  const copy = strings.marketing.terms;
  return (
    <LegalDocument
      title={copy.title}
      updated={copy.updated}
      note={copy.note}
      contactLabel={copy.contactLabel}
      sections={copy.sections}
    />
  );
}
