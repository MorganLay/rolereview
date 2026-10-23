import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { strings } from "@/copy/strings";

export const metadata: Metadata = {
  title: strings.pages.milestones.title,
  description: strings.pages.milestones.body,
};

/** Stub until Phase 15 (1.1). */
export default function MilestonesPage() {
  return (
    <PlaceholderPage
      title={strings.pages.milestones.title}
      body={strings.pages.milestones.body}
    />
  );
}
