import Link from "next/link";

import { strings } from "@/copy/strings";

type Span = { kind: "text"; text: string } | { kind: "link"; href: string; text: string };

const linkClass =
  "text-pine underline decoration-pine/30 underline-offset-4 hover:decoration-pine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine rounded-sm";

function Spans({ spans }: { spans: readonly Span[] }) {
  return spans.map((span, index) =>
    span.kind === "text" ? (
      <span key={index}>{span.text}</span>
    ) : span.href.startsWith("/") ? (
      <Link key={index} href={span.href} className={linkClass}>
        {span.text}
      </Link>
    ) : (
      <a key={index} href={span.href} className={linkClass}>
        {span.text}
      </a>
    ),
  );
}

function Blocks({
  blocks,
}: {
  blocks: readonly (
    | { kind: "p"; spans: readonly Span[] }
    | { kind: "h"; text: string }
    | { kind: "list"; items: readonly (readonly Span[])[] }
  )[];
}) {
  return blocks.map((block, index) => {
    if (block.kind === "h") {
      return (
        <h3 key={block.text} className="mt-8 text-base font-medium text-ink">
          {block.text}
        </h3>
      );
    }
    if (block.kind === "list") {
      return (
        <ul key={index} className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed text-ink">
          {block.items.map((item) => (
            <li key={item.map((span) => span.text).join("")}>
              <Spans spans={item} />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={block.spans.map((span) => span.text).join("")} className="mt-4 text-base leading-relaxed text-ink">
        <Spans spans={block.spans} />
      </p>
    );
  });
}

export function PrivacyPage() {
  const copy = strings.marketing.privacy;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">{copy.title}</h1>
      <p className="mt-3 text-sm text-slate">{copy.updated}</p>
      <p className="mt-4 text-sm leading-relaxed text-slate">{copy.note}</p>
      <Blocks blocks={copy.intro} />

      <section id={copy.requests.id} className="mt-10 scroll-mt-20 border-y border-line py-6">
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {copy.requests.heading}
        </h2>
        <Blocks blocks={copy.requests.blocks} />
      </section>

      <section aria-labelledby="privacy-glance" className="mt-10">
        <h2
          id="privacy-glance"
          className="font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
        >
          {copy.glanceTitle}
        </h2>
        <dl className="mt-4 border-t border-line">
          {copy.glance.map((item) => (
            <div key={item.title} className="border-b border-line py-4">
              <dt className="text-sm font-medium text-ink">{item.title}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate">
                <Spans spans={item.spans} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <nav aria-label={copy.tocLabel} className="mt-10">
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {copy.tocLabel}
        </h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed sm:columns-2 sm:gap-x-8 [&>li]:break-inside-avoid">
          <li>
            <a href={`#${copy.requests.id}`} className={linkClass}>
              {copy.requests.heading}
            </a>
          </li>
          {copy.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={linkClass}>
                {section.heading}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {copy.sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-12 scroll-mt-20">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {section.heading}
          </h2>
          <Blocks blocks={section.blocks} />
        </section>
      ))}
    </article>
  );
}
