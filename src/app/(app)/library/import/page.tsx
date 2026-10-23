import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { strings } from "@/copy/strings";
import { ImportFlow } from "@/features/import/components/import-flow";
import { getImportPage } from "@/features/import/queries";
import { requireUser } from "@/lib/auth";

/** Import calls the model and may upload a 5 MB file. */
export const maxDuration = 120;

export const metadata: Metadata = {
  title: strings.pages.libraryImport.title,
  description: strings.pages.libraryImport.body,
};

/** Library counts and the onboarding flag come from the signed-in user. */
export const instant = false;

export default async function LibraryImportPage() {
  const user = await requireUser();
  const page = await getImportPage(user);
  if (!page) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {strings.pages.libraryImport.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate">
          {page.onboarding
            ? strings.library.import.welcome
            : strings.pages.libraryImport.body}
        </p>
      </div>
      <ImportFlow
        libraryHasContent={page.libraryHasContent}
        importsLeft={page.importsLeft}
        email={page.email}
      />
    </div>
  );
}
