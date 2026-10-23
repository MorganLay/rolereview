import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { strings } from "@/copy/strings";
import { env } from "@/lib/env";

import { StyleguideContent } from "./styleguide-content";

export const metadata: Metadata = {
  title: strings.styleguide.title,
  description: strings.styleguide.intro,
  robots: { index: false, follow: false },
};

export default function StyleguidePage() {
  if (env.NODE_ENV === "production") {
    notFound();
  }

  return <StyleguideContent />;
}
