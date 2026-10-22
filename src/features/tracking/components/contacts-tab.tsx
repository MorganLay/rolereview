"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import type { FieldErrors } from "@/lib/result";

import {
  linkJobContact,
  logOutreach,
  unlinkJobContact,
  updateJobContactRole,
} from "../actions";
import {
  CONTACT_ROLES,
  matchesContactSearch,
  type ContactPick,
  type ContactRoleName,
  type JobContactView,
} from "../contacts";
import { EVENT_LIMITS } from "../schemas";
import { ContactDialog, type ContactDialogMode } from "./contact-dialog";

const copy = strings.contacts;

export function ContactsTab({
  jobId,
  linked,
  directory,
}: {
  jobId: string;
  linked: JobContactView[];
  directory: ContactPick[];
}) {
  const [mode, setMode] = useState<ContactDialogMode | null>(null);
  const [linking, setLinking] = useState(false);
  const [outreach, setOutreach] = useState<JobContactView | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => setLinking(true)}>
          {copy.linkExisting}
        </Button>
        <Button type="button" onClick={() => setMode({ kind: "add", jobId })}>
          {copy.newContact}
        </Button>
      </div>

      {linked.length === 0 ? (
        <p className="text-sm text-slate">{copy.jobEmpty}</p>
      ) : (
        <ul aria-label={copy.listLabel} className="flex flex-col">
          {linked.map((contact) => (
            <ContactRow
              key={contact.id}
              jobId={jobId}
              contact={contact}
              onOutreach={() => setOutreach(contact)}
            />
          ))}
        </ul>
      )}

      <ContactDialog
        mode={mode}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
      />
      <LinkDialog
        jobId={jobId}
        directory={directory}
        open={linking}
        onOpenChange={setLinking}
      />
      <OutreachDialog
        jobId={jobId}
        contact={outreach}
        onOpenChange={(open) => {
          if (!open) setOutreach(null);
        }}
      />
    </div>
  );
}

function ContactRow({
  jobId,
  contact,
  onOutreach,
}: {
  jobId: string;
  contact: JobContactView;
  onOutreach: () => void;
}) {
  const router = useRouter();
  const roleId = useId();
  const [pendingRole, setPendingRole] = useState(false);
  const [pendingUnlink, setPendingUnlink] = useState(false);
  const subtitle = [contact.title, contact.company].filter(Boolean).join(" · ");

  async function onRole(value: string) {
    if (!isRole(value) || value === contact.role || pendingRole) return;
    setPendingRole(true);
    const result = await updateJobContactRole({
      jobId,
      contactId: contact.id,
      role: value,
    });
    setPendingRole(false);
    if (!result.ok) {
      toast.error(result.error.code === "NOT_FOUND" ? copy.notFound : copy.saveFailed);
      return;
    }
    toast.success(copy.roleSaved);
    router.refresh();
  }

  async function onUnlink() {
    if (pendingUnlink) return;
    setPendingUnlink(true);
    const result = await unlinkJobContact({ jobId, contactId: contact.id });
    setPendingUnlink(false);
    if (!result.ok) {
      toast.error(result.error.code === "NOT_FOUND" ? copy.notFound : copy.unlinkFailed);
      return;
    }
    toast.success(copy.unlinked);
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium break-words text-ink">{contact.name}</p>
        {subtitle ? <p className="text-sm break-words text-slate">{subtitle}</p> : null}
        {contact.email ? (
          <p className="text-sm break-all text-ink">{contact.email}</p>
        ) : null}
        <p className="text-xs text-slate">
          {copy.lastContacted}: {contact.lastContactedLabel ?? copy.emptyValue}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="grid gap-1 sm:min-w-40">
          <Label htmlFor={roleId} className="sr-only">
            {copy.roleFor(contact.name)}
          </Label>
          <Select value={contact.role} onValueChange={onRole} disabled={pendingRole}>
            <SelectTrigger id={roleId} className="w-full" aria-label={copy.roleFor(contact.name)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_ROLES.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.roles[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOutreach}>
          {copy.logOutreach}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onUnlink}
          disabled={pendingUnlink}
          aria-label={copy.unlinkFor(contact.name)}
        >
          {pendingUnlink ? copy.saving : copy.unlink}
        </Button>
      </div>
    </li>
  );
}

function LinkDialog({
  jobId,
  directory,
  open,
  onOpenChange,
}: {
  jobId: string;
  directory: ContactPick[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const searchId = useId();
  const roleId = useId();
  const listId = useId();
  const [wasOpen, setWasOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [role, setRole] = useState<ContactRoleName>("OTHER");
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setQuery("");
    setSelected(null);
    setRole("OTHER");
    setChooseError(null);
    setPending(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const filtered = useMemo(
    () =>
      directory.filter((person) =>
        matchesContactSearch(
          { name: person.name, title: person.title, company: person.company, email: null },
          query,
        ),
      ),
    [directory, query],
  );

  function begin(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!selected) {
      setChooseError(copy.errors.choose);
      return;
    }
    setPending(true);
    setChooseError(null);
    const result = await linkJobContact({ jobId, contactId: selected, role });
    setPending(false);
    if (!result.ok) {
      if (result.error.code === "CONFLICT") {
        toast.error(copy.alreadyLinked);
        return;
      }
      if (result.error.code === "NOT_FOUND") {
        toast.error(copy.notFound);
        return;
      }
      toast.error(copy.linkFailed);
      return;
    }
    toast.success(copy.linked);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">{copy.linkTitle}</DialogTitle>
            <DialogDescription>{copy.linkBody}</DialogDescription>
          </DialogHeader>
          {directory.length === 0 ? (
            <p className="text-sm text-slate">{copy.linkEmpty}</p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor={searchId}>{copy.linkSearchLabel}</Label>
                <Input
                  id={searchId}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.linkSearchPlaceholder}
                />
              </div>
              {filtered.length === 0 ? (
                <p className="text-sm text-slate">{copy.emptySearch}</p>
              ) : (
                <ul
                  id={listId}
                  role="listbox"
                  aria-label={copy.linkTitle}
                  className="flex max-h-52 flex-col gap-1 overflow-y-auto"
                >
                  {filtered.map((person) => {
                    const subtitle = [person.title, person.company].filter(Boolean).join(" · ");
                    const active = selected === person.id;
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={
                            active
                              ? "w-full rounded-md border border-pine bg-muted px-3 py-2 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                              : "w-full rounded-md border border-line px-3 py-2 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          }
                          onClick={() => {
                            setSelected(person.id);
                            setChooseError(null);
                          }}
                        >
                          <span className="block text-sm font-medium break-words text-ink">
                            {person.name}
                          </span>
                          {subtitle ? (
                            <span className="block text-xs break-words text-slate">{subtitle}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {chooseError ? <FieldAlert message={chooseError} /> : null}
              <div className="grid gap-2">
                <Label htmlFor={roleId}>{copy.roleLabel}</Label>
                <Select
                  value={role}
                  onValueChange={(value) => {
                    if (isRole(value)) setRole(value);
                  }}
                >
                  <SelectTrigger id={roleId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_ROLES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {copy.roles[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => begin(false)} disabled={pending}>
              {strings.common.cancel}
            </Button>
            {directory.length > 0 ? (
              <Button type="submit" disabled={pending}>
                {pending ? copy.saving : copy.linkExisting}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OutreachDialog({
  jobId,
  contact,
  onOpenChange,
}: {
  jobId: string;
  contact: JobContactView | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const formId = useId();
  const open = contact !== null;
  const [wasOpen, setWasOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  if (contact && !wasOpen) {
    setWasOpen(true);
    setDetails("");
    setErrors({});
    setPending(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  function begin(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || !contact) return;
    setPending(true);
    setErrors({});
    const result = await logOutreach({ jobId, contactId: contact.id, details });
    setPending(false);
    if (!result.ok) {
      if (result.error.code === "VALIDATION" && result.error.fields) {
        setErrors(result.error.fields);
        if (result.error.fields.details?.[0] || result.error.fields.contactId?.[0]) return;
      }
      if (result.error.code === "NOT_FOUND") {
        toast.error(copy.notFound);
        return;
      }
      toast.error(copy.outreachFailed);
      return;
    }
    toast.success(copy.outreachLogged);
    onOpenChange(false);
    router.refresh();
  }

  const detailsOver = details.length > EVENT_LIMITS.details;
  const detailsError = errors.details?.[0];

  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">{copy.outreachTitle}</DialogTitle>
            <DialogDescription>
              {contact ? `${contact.name}. ${copy.outreachBody}` : copy.outreachBody}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-details`}>{copy.detailsLabel}</Label>
            <Textarea
              id={`${formId}-details`}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              aria-invalid={Boolean(detailsError) || detailsOver}
              aria-describedby={`${formId}-details-count`}
            />
            <p
              id={`${formId}-details-count`}
              className={detailsOver ? "text-xs text-destructive" : "text-xs text-slate"}
            >
              {copy.detailsCount(details.length)}
            </p>
            {detailsError ? <FieldAlert message={detailsError} /> : null}
            {errors.contactId?.[0] ? <FieldAlert message={errors.contactId[0]} /> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => begin(false)} disabled={pending}>
              {strings.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? copy.saving : copy.logOutreach}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function isRole(value: string): value is ContactRoleName {
  return (CONTACT_ROLES as readonly string[]).includes(value);
}

function FieldAlert({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
