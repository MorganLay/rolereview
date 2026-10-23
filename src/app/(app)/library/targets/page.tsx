import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { strings } from "@/copy/strings";

export const metadata: Metadata = {
  title: strings.pages.libraryTargets.title,
  description: strings.pages.libraryTargets.body,
};

/** Stub until Phase 18 (1.1). */
export default function LibraryTargetsPage() {
  return (
    <PlaceholderPage
      title={strings.pages.libraryTargets.title}
      body={strings.pages.libraryTargets.body}
    />
  );
}
