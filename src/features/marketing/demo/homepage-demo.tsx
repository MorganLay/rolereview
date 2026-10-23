"use client";

import { DemoExperience } from "@/features/marketing/demo/demo-experience";
import { loadClientCatalog } from "@/features/marketing/demo/client-catalog";

const demos = loadClientCatalog();

/** Homepage demo. Imported only after the section is near the viewport. */
export function HomepageDemo() {
  return <DemoExperience demos={demos} heading="h2" />;
}
