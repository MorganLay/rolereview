import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { KeywordChecker } from "@/features/marketing/tools/components/keyword-checker";

const copy = strings.marketing.tools.keyword;

export const maxDuration = 120;

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
  alternates: { canonical: "/tools/ats-keyword-checker" },
};

export default function AtsKeywordCheckerPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">
        {copy.title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate">{copy.body}</p>
      <div className="mt-10">
        <KeywordChecker />
      </div>
    </section>
  );
}
