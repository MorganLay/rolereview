import { strings } from "@/copy/strings";
import { CONTACT_LIMITS } from "@/features/tracking/contacts";
import { ContactsWorkspace } from "@/features/tracking/components/contacts-workspace";
import { listContacts } from "@/features/tracking/queries";
import { requireUser } from "@/lib/auth";

/** The list comes from the signed-in user. */
export const instant = false;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const q = contactSearchQuery(query.q);
  const listed = await listContacts(user.id, q);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {strings.pages.contacts.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate">{strings.pages.contacts.body}</p>
      </div>
      <ContactsWorkspace contacts={listed.contacts} query={q} total={listed.total} />
    </div>
  );
}

function contactSearchQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim().slice(0, CONTACT_LIMITS.search);
}
