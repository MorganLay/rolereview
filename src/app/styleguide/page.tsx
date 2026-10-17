import { notFound } from "next/navigation";

import { env } from "@/lib/env";

import { StyleguideContent } from "./styleguide-content";

export default function StyleguidePage() {
  if (env.NODE_ENV === "production") {
    notFound();
  }

  return <StyleguideContent />;
}
