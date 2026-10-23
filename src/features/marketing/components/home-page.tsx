import {
  Clock,
  FileCheck,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { faqItems, faqJsonLd } from "@/features/marketing/faq";
import type { MarketingPricingView } from "@/features/marketing/present";

import { CtaLink } from "./cta-link";
import { DeferredHomepageDemo } from "./deferred-homepage-demo";
import { HomeFaq } from "./home-faq";
import { HeroLoop } from "./hero-loop";
import { HomePricing } from "./home-pricing";
import {
  ShotBoard,
  ShotInsights,
  ShotJob,
  ShotKeywords,
  ShotLetter,
  ShotLibrary,
  ShotMatch,
  ShotReminders,
  ShotResume,
} from "./product-shots";

const copy = strings.marketing.home;

export function HomePage({ pricing }: { pricing: MarketingPricingView }) {
  const faqs = faqItems(pricing.freeTailor);

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }}
      />

      <Hero freeTailor={pricing.freeTailor} />
      <TrustStrip />
      <Problem />
      <HowItWorks />
      <Demo />
      <Differentiator />
      <FeatureGrid />
      <FounderNote />
      <HomePricing pricing={pricing} />
      <HomeFaq items={faqs} />
      <FinalCta />
    </div>
  );
}

function Hero({ freeTailor }: { freeTailor: number }) {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:py-20">
      <div className="max-w-xl">
        <p className="text-sm font-medium text-pine">{copy.eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3rem] lg:leading-[1.15]">
          {copy.title}
        </h1>
        <p className="mt-4 text-lg text-slate">{copy.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <CtaLink location="hero" />
          <Button asChild variant="outline" className="min-h-11 px-4">
            <a href="#demo">{copy.tryDemo}</a>
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate">{copy.microcopy(freeTailor)}</p>
      </div>
      <HeroLoop />
    </section>
  );
}

function TrustStrip() {
  const items = [
    { icon: FileCheck, label: copy.trustAts },
    { icon: ShieldCheck, label: copy.trustSources },
    { icon: Clock, label: copy.trustRefund },
    { icon: MapPin, label: copy.trustOttawa },
  ];
  return (
    <section
      aria-label={copy.trustTitle}
      className="border-y border-line bg-surface"
    >
      <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-3">
            <item.icon className="mt-0.5 size-5 shrink-0 text-pine" aria-hidden />
            <span className="text-sm text-ink">{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Problem() {
  const cards = [
    { title: copy.problemSlowTitle, body: copy.problemSlowBody },
    { title: copy.problemAiTitle, body: copy.problemAiBody },
    { title: copy.problemTrackTitle, body: copy.problemTrackBody },
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="max-w-2xl font-serif text-3xl font-semibold tracking-tight text-ink">
        {copy.problemTitle}
      </h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <li
            key={card.title}
            className="rounded-card border border-line bg-surface p-5"
          >
            <h3 className="font-medium text-ink">{card.title}</h3>
            <p className="mt-2 text-sm text-slate">{card.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { title: copy.howStep1Title, body: copy.howStep1Body, shot: <ShotLibrary /> },
    { title: copy.howStep2Title, body: copy.howStep2Body, shot: <ShotJob /> },
    { title: copy.howStep3Title, body: copy.howStep3Body, shot: <ShotResume highlight /> },
  ];
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y border-line bg-surface"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="max-w-2xl font-serif text-3xl font-semibold tracking-tight text-ink">
          {copy.howItWorksTitle}
        </h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-4">
              <p className="text-sm font-medium tabular-nums text-pine">
                {index + 1}
              </p>
              <h3 className="font-medium text-ink">{step.title}</h3>
              <p className="text-sm text-slate">{step.body}</p>
              {step.shot}
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <CtaLink location="how-it-works" />
        </div>
      </div>
    </section>
  );
}

function Demo() {
  return (
    <section id="demo" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <DeferredHomepageDemo />
      </div>
    </section>
  );
}

function Differentiator() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="max-w-3xl font-serif text-3xl font-semibold tracking-tight text-ink">
        {copy.differentiatorTitle}
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-card border border-line bg-surface p-5">
          <p className="text-sm font-medium text-slate">{copy.genericAiLabel}</p>
          <p className="mt-3 rounded-button bg-clay/10 px-3 py-2 text-sm leading-relaxed text-ink">
            {copy.genericAiBullet}
          </p>
          <p className="mt-3 text-sm text-slate">{copy.genericAiCaption}</p>
        </article>
        <article className="rounded-card border border-line bg-surface p-5">
          <p className="text-sm font-medium text-pine">{copy.roleRefineLabel}</p>
          <p className="mt-3 rounded-button bg-pine-50 px-3 py-2 text-sm leading-relaxed text-ink">
            {copy.roleRefineBullet}
          </p>
          <p className="mt-2 text-xs font-medium text-pine">{copy.roleRefineSource}</p>
          <p className="mt-1 text-xs text-slate">{copy.roleRefineRestored}</p>
          <p className="mt-3 text-sm text-slate">{copy.roleRefineCaption}</p>
        </article>
      </div>
      <p className="mt-4 text-sm text-slate">{copy.differentiatorNote}</p>
    </section>
  );
}

function FeatureGrid() {
  const tiles = [
    { title: copy.featureMatchTitle, body: copy.featureMatchBody, shot: <ShotMatch /> },
    {
      title: copy.featureKeywordsTitle,
      body: copy.featureKeywordsBody,
      shot: <ShotKeywords />,
    },
    { title: copy.featureLetterTitle, body: copy.featureLetterBody, shot: <ShotLetter /> },
    { title: copy.featureBoardTitle, body: copy.featureBoardBody, shot: <ShotBoard /> },
    {
      title: copy.featureRemindersTitle,
      body: copy.featureRemindersBody,
      shot: <ShotReminders />,
    },
    {
      title: copy.featureInsightsTitle,
      body: copy.featureInsightsBody,
      shot: <ShotInsights />,
    },
  ];
  return (
    <section id="features" className="scroll-mt-20 border-y border-line bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="max-w-2xl font-serif text-3xl font-semibold tracking-tight text-ink">
          {copy.featuresTitle}
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <li key={tile.title} className="flex flex-col gap-3">
              {tile.shot}
              <h3 className="font-medium text-ink">{tile.title}</h3>
              <p className="text-sm text-slate">{tile.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FounderNote() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink">
        {copy.founderTitle}
      </h2>
      <div className="mt-6 flex gap-4">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-card bg-pine text-lg font-semibold text-white"
          aria-hidden
        >
          M
        </div>
        <div>
          <p className="text-base leading-relaxed text-ink">{copy.founderBody}</p>
          <p className="mt-3 text-sm text-slate">{copy.founderName}</p>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-line bg-pine-50">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink">
          {copy.finalTitle}
        </h2>
        <p className="text-base text-slate">{copy.finalBody}</p>
        <CtaLink location="final" />
      </div>
    </section>
  );
}
