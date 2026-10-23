import { notFound } from "next/navigation";

import { EXPORT_FILENAME } from "@/features/account/export";
import { loadAccountExport } from "@/features/account/queries";
import { requireUser } from "@/lib/auth";
import { contentDisposition } from "@/lib/pdf/filename";

/** JSON download of every row owned by the signed-in user. */
export async function GET() {
  const user = await requireUser();
  const body = await loadAccountExport(user.id, new Date());
  if (!body) notFound();

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": contentDisposition(EXPORT_FILENAME),
      "Cache-Control": "private, no-store",
    },
  });
}
