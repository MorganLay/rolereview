import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { strings } from "@/copy/strings";
import { LibraryScreen } from "@/features/library/components/library-screen";
import { getLibrary } from "@/features/library/queries";
import { listWordings } from "@/features/library/wording-store";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: strings.pages.library.title,
  description: strings.pages.library.body,
};

/** Profile comes from the signed-in user row — not an instant static shell. */
export const instant = false;

export const maxDuration = 120;

export default async function LibraryPage() {
  await connection();
  const user = await requireUser();
  const library = await getLibrary(user.id);
  if (!library) notFound();
  const wordings = await listWordings(user.id);

  return <LibraryScreen library={library} wordings={wordings} />;
}
