import { strings } from "@/copy/strings";
import { CtaLink } from "@/features/marketing/components/cta-link";

const copy = strings.marketing.about;
const founder = strings.marketing.home;

export function AboutPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">
        {copy.title}
      </h1>

      <section className="mt-10">
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink">
          {founder.founderTitle}
        </h2>
        <div className="mt-6 flex gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-card bg-pine text-lg font-semibold text-white"
            aria-hidden
          >
            M
          </div>
          <div>
            <p className="text-base leading-relaxed text-ink">{founder.founderBody}</p>
            <p className="mt-3 text-sm text-slate">{founder.founderName}</p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink">
          {copy.truthfulTitle}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink">{copy.truthfulBody}</p>
        <p className="mt-4 text-base leading-relaxed text-ink">{copy.truthfulLetter}</p>
        <div className="mt-8">
          <CtaLink location="about" />
        </div>
      </section>

      <section id="contact" className="mt-12 scroll-mt-20">
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink">
          {copy.contactTitle}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink">{copy.contactBody}</p>
      </section>
    </article>
  );
}
