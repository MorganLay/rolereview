import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { strings } from "@/copy/strings";
import { requireAdmin } from "@/lib/auth";

/** Stub until Phase 20 admin UI. requireAdmin → 404 for non-admins. */
export default async function AdminPage() {
  await requireAdmin();

  return (
    <PlaceholderPage
      title={strings.admin.title}
      body={strings.admin.body}
    />
  );
}
