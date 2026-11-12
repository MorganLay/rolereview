import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

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
  await connection();
  const user = await requireUser();
  const page = await getImportPage(user);
  if (!page) notFound();

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col">
      <ImportFlow
        onboarding={page.onboarding}
        libraryHasContent={page.libraryHasContent}
        importsLeft={page.importsLeft}
        email={page.email}
        roles={page.roles}
      />
    </div>
  );
}
