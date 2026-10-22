import Link from "next/link";

import { Wordmark } from "@/components/marketing/wordmark";
import { strings } from "@/copy/strings";
import { NewsletterForm } from "@/features/marketing/components/newsletter-form";

type FooterLink =
  | { kind: "link"; href: string; label: string }
  | { kind: "soon"; label: string };

const productLinks: FooterLink[] = [
  { kind: "link", href: "/#features", label: strings.marketing.footer.features },
  { kind: "link", href: "/#pricing", label: strings.marketing.footer.pricing },
  { kind: "soon", label: strings.marketing.footer.demo },
  { kind: "soon", label: strings.marketing.footer.changelog },
];

const freeToolLinks: FooterLink[] = [
  { kind: "soon", label: strings.marketing.footer.atsChecker },
  { kind: "soon", label: strings.marketing.footer.bulletStrength },
];

const companyLinks: FooterLink[] = [
  { kind: "soon", label: strings.marketing.footer.about },
  { kind: "soon", label: strings.marketing.footer.contact },
];

const legalLinks: FooterLink[] = [
  { kind: "soon", label: strings.marketing.footer.privacy },
  { kind: "soon", label: strings.marketing.footer.terms },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: FooterLink[];
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((item) => (
          <li key={item.label}>
            {item.kind === "link" ? (
              <Link
                href={item.href}
                className="text-sm text-slate transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className="text-sm text-slate/60"
                title={strings.marketing.nav.comingSoon}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(0,0.7fr))_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <Link href="/" aria-label={strings.brand.name} className="inline-flex">
            <Wordmark className="h-6" />
          </Link>
          <p className="max-w-xs text-sm text-slate">{strings.brand.shortDescriptor}</p>
        </div>

        <FooterColumn title={strings.marketing.footer.product} links={productLinks} />
        <FooterColumn title={strings.marketing.footer.freeTools} links={freeToolLinks} />
        <div className="space-y-8">
          <FooterColumn title={strings.marketing.footer.company} links={companyLinks} />
          <FooterColumn title={strings.marketing.footer.legal} links={legalLinks} />
        </div>

        <div>
          <h2 className="text-sm font-medium text-ink">{strings.marketing.footer.newsletterTitle}</h2>
          <p className="mt-2 text-sm text-slate">{strings.marketing.footer.newsletterBody}</p>
          <div className="mt-4">
            <NewsletterForm />
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-slate sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{strings.marketing.footer.copyright}</p>
          <p>{strings.marketing.footer.madeIn}</p>
        </div>
      </div>
    </footer>
  );
}
