import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { DemoExperience } from "@/features/marketing/demo/demo-experience";
import { loadDemoCatalog } from "@/features/marketing/demo/load";

const copy = strings.marketing.demo;

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.metaDescription,
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <DemoExperience demos={loadDemoCatalog()} heading="h1" />
    </section>
  );
}
