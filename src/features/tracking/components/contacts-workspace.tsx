"use client";

import { useId, useState, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { strings } from "@/copy/strings";

import { deleteContact } from "../actions";
import type { ContactListItem } from "../contacts";
import { ContactDialog, type ContactDialogMode } from "./contact-dialog";

const copy = strings.contacts;

export function ContactsWorkspace({
  contacts,
  query,
  total,
}: {
  contacts: ContactListItem[];
  query: string;
  total: number;
}) {
  const router = useRouter();
  const searchId = useId();
  const [draft, setDraft] = useState(query);
  const [mode, setMode] = useState<ContactDialogMode | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ContactListItem | null>(null);
  const open = contacts.find((contact) => contact.id === openId) ?? null;

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    const next = draft.trim();
    if (next) params.set("q", next);
    router.push(params.size > 0 ? `/contacts?${params}` : "/contacts");
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form onSubmit={onSearch} className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor={searchId}>{copy.searchLabel}</Label>
            <Input
              id={searchId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={copy.searchPlaceholder}
            />
          </div>
          <Button type="submit" variant="outline">
            {copy.search}
          </Button>
        </form>
        <Button type="button" onClick={() => setMode({ kind: "add" })}>
          {copy.add}
        </Button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-slate">{total === 0 ? copy.empty : copy.emptySearch}</p>
      ) : (
        <>
        <ul className="flex flex-col gap-3 md:hidden" aria-label={copy.listLabel}>
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="min-w-0 rounded-lg border border-line bg-surface p-4"
            >
              <button
                type="button"
                className="flex w-full min-w-0 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => setOpenId(contact.id)}
              >
                <span className="font-medium break-words text-ink">{contact.name}</span>
                <span className="text-sm break-words text-slate">
                  {[contact.title, contact.company].filter(Boolean).join(" · ") || copy.emptyValue}
                </span>
                <span className="text-sm break-all text-ink">
                  {contact.email ?? copy.emptyValue}
                </span>
                <span className="text-sm text-slate">
                  {copy.lastContacted}
                  {" · "}
                  <span className="text-ink">
                    {contact.lastContactedLabel ?? copy.emptyValue}
                  </span>
                </span>
              </button>
              <div className="mt-3 min-w-0">
                <p className="text-xs text-slate">{copy.columns.jobs}</p>
                {contact.jobs.length === 0 ? (
                  <p className="text-sm text-ink">{copy.emptyValue}</p>
                ) : (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {contact.jobs.map((job) => (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}?tab=contacts`}
                        className="inline-flex max-w-full rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs break-words text-ink underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {job.company}
                        <span className="sr-only">, {job.title}</span>
                      </Link>
                    ))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.columns.name}</TableHead>
              <TableHead>{copy.columns.title}</TableHead>
              <TableHead>{copy.columns.company}</TableHead>
              <TableHead>{copy.columns.email}</TableHead>
              <TableHead>{copy.columns.jobs}</TableHead>
              <TableHead>{copy.columns.lastContacted}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer"
                onClick={() => setOpenId(contact.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpenId(contact.id);
                  }
                }}
                tabIndex={0}
                aria-label={copy.openFor(contact.name)}
              >
                <TableCell className="whitespace-normal font-medium break-words text-ink">
                  {contact.name}
                </TableCell>
                <TableCell className="whitespace-normal break-words">
                  {contact.title ?? copy.emptyValue}
                </TableCell>
                <TableCell className="whitespace-normal break-words">
                  {contact.company ?? copy.emptyValue}
                </TableCell>
                <TableCell className="whitespace-normal break-all">
                  {contact.email ?? copy.emptyValue}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {contact.jobs.length === 0 ? (
                    copy.emptyValue
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {contact.jobs.map((job) => (
                        <Link
                          key={job.id}
                          href={`/jobs/${job.id}?tab=contacts`}
                          onClick={stopRow}
                          className="inline-flex max-w-full rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs break-words text-ink underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {job.company}
                          <span className="sr-only">, {job.title}</span>
                        </Link>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {contact.lastContactedLabel ?? copy.emptyValue}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        </>
      )}

      <ContactDrawer
        contact={open}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        onEdit={() => {
          if (open) setMode({ kind: "edit", contact: open });
        }}
        onDelete={() => {
          if (open) setDeleting(open);
        }}
      />
      <ContactDialog
        mode={mode}
        onOpenChange={(next) => {
          if (!next) setMode(null);
        }}
      />
      <DeleteContactDialog
        contact={deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        onDeleted={() => {
          setOpenId(null);
          setDeleting(null);
        }}
      />
    </div>
  );
}

function stopRow(event: MouseEvent) {
  event.stopPropagation();
}

function ContactDrawer({
  contact,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  contact: ContactListItem | null;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const subtitle = contact
    ? [contact.title, contact.company].filter(Boolean).join(" · ")
    : "";

  return (
    <Sheet open={contact !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" side="right">
        {contact ? (
          <>
            <SheetHeader className="pr-10">
              <SheetTitle className="font-sans break-words">{contact.name}</SheetTitle>
              {subtitle ? <SheetDescription className="break-words">{subtitle}</SheetDescription> : null}
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 pb-4">
              <dl className="grid gap-2 text-sm">
                <Detail term={copy.emailLabel} value={contact.email} href={mailHref(contact.email)} />
                <Detail term={copy.phoneLabel} value={contact.phone} />
                <Detail
                  term={copy.linkedinLabel}
                  value={contact.linkedinUrl}
                  href={contact.linkedinUrl}
                />
                <Detail term={copy.lastContacted} value={contact.lastContactedLabel} />
              </dl>
              {contact.notes ? (
                <p className="text-sm break-words whitespace-pre-wrap text-ink">{contact.notes}</p>
              ) : null}
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-ink">{copy.linkedJobs}</h2>
                {contact.jobs.length === 0 ? (
                  <p className="text-sm text-slate">{copy.emptyValue}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {contact.jobs.map((job) => (
                      <li key={job.id} className="text-sm break-words">
                        <Link
                          href={`/jobs/${job.id}?tab=contacts`}
                          className="text-ink underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {job.company} · {job.title}
                        </Link>
                        <span className="text-slate"> · {copy.roles[job.role]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-ink">{copy.outreach}</h2>
                {contact.outreach.length === 0 ? (
                  <p className="text-sm text-slate">{copy.outreachEmpty}</p>
                ) : (
                  <ol className="flex flex-col">
                    {contact.outreach.map((event) => (
                      <li key={event.id} className="border-b border-line py-2 last:border-b-0">
                        <p className="text-sm break-words text-ink">{event.jobLabel}</p>
                        {event.details ? (
                          <p className="text-sm break-words whitespace-pre-wrap text-ink">
                            {event.details}
                          </p>
                        ) : null}
                        <p className="text-xs text-slate">
                          <time dateTime={event.occurredAt}>{event.whenLabel}</time>
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onEdit}>
                  {strings.common.edit}
                </Button>
                <Button type="button" variant="outline" onClick={onDelete}>
                  {strings.common.delete}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Detail({
  term,
  value,
  href,
}: {
  term: string;
  value: string | null;
  href?: string | null;
}) {
  return (
    <div>
      <dt className="text-slate">{term}</dt>
      <dd className="break-words text-ink">
        {value && href ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {value}
          </a>
        ) : (
          (value ?? copy.emptyValue)
        )}
      </dd>
    </div>
  );
}

function mailHref(email: string | null): string | null {
  if (!email) return null;
  return `mailto:${email}`;
}

function DeleteContactDialog({
  contact,
  onOpenChange,
  onDeleted,
}: {
  contact: ContactListItem | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete(event: MouseEvent) {
    event.preventDefault();
    if (!contact || pending) return;
    setPending(true);
    try {
      const result = await deleteContact({ contactId: contact.id });
      if (!result.ok) {
        toast.error(result.error.code === "NOT_FOUND" ? copy.notFound : copy.deleteFailed);
        return;
      }
      toast.success(copy.deleted);
      onDeleted();
      router.refresh();
    } catch {
      toast.error(copy.deleteFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={contact !== null}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-sans">{copy.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy.deleteBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{strings.common.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={onDelete}>
            {pending ? copy.deleting : strings.common.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
