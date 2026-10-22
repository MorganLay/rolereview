"use client";

import { useId, useState, type FormEvent } from "react";
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

import { createContact, updateContact } from "../actions";
import { CONTACT_LIMITS, CONTACT_ROLES, type ContactRoleName } from "../contacts";

const copy = strings.contacts;

export type ContactDraft = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
};

export type ContactDialogMode =
  | { kind: "add"; jobId?: string }
  | { kind: "edit"; contact: ContactDraft };

const emptyFields = {
  name: "",
  title: "",
  company: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  notes: "",
};

export function ContactDialog({
  mode,
  onOpenChange,
}: {
  mode: ContactDialogMode | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const formId = useId();
  const open = mode !== null;
  const [wasOpen, setWasOpen] = useState(false);
  const [fields, setFields] = useState(emptyFields);
  const [role, setRole] = useState<ContactRoleName>("OTHER");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  if (mode && !wasOpen) {
    setWasOpen(true);
    setErrors({});
    setPending(false);
    setRole("OTHER");
    if (mode.kind === "edit") {
      setFields({
        name: mode.contact.name,
        title: mode.contact.title ?? "",
        company: mode.contact.company ?? "",
        email: mode.contact.email ?? "",
        phone: mode.contact.phone ?? "",
        linkedinUrl: mode.contact.linkedinUrl ?? "",
        notes: mode.contact.notes ?? "",
      });
    } else {
      setFields(emptyFields);
    }
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  function begin(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  function setField(key: keyof typeof emptyFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || !mode) return;
    setPending(true);
    setErrors({});
    const result =
      mode.kind === "edit"
        ? await updateContact({ ...fields, contactId: mode.contact.id })
        : await createContact({
            ...fields,
            ...(mode.jobId ? { jobId: mode.jobId, role } : {}),
          });
    setPending(false);
    if (!result.ok) {
      if (result.error.code === "VALIDATION" && result.error.fields) {
        setErrors(result.error.fields);
        const shown = Object.keys(emptyFields).some((key) => result.error.fields?.[key]?.[0]);
        if (shown || result.error.fields.role?.[0]) return;
      }
      if (result.error.code === "NOT_FOUND") {
        toast.error(mode.kind === "add" && mode.jobId ? copy.jobMissing : copy.notFound);
        return;
      }
      toast.error(copy.saveFailed);
      return;
    }
    toast.success(mode.kind === "edit" ? copy.saved : copy.added);
    onOpenChange(false);
    router.refresh();
  }

  const notesOver = fields.notes.length > CONTACT_LIMITS.notes;
  const showRole = mode?.kind === "add" && Boolean(mode.jobId);

  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">
              {mode?.kind === "edit" ? copy.dialogEditTitle : copy.dialogAddTitle}
            </DialogTitle>
            <DialogDescription>{copy.dialogBody}</DialogDescription>
          </DialogHeader>
          <TextField
            id={`${formId}-name`}
            label={copy.nameLabel}
            value={fields.name}
            error={errors.name?.[0]}
            onChange={(value) => setField("name", value)}
            maxLengthHint={fields.name.length > CONTACT_LIMITS.name}
          />
          <TextField
            id={`${formId}-title`}
            label={copy.titleLabel}
            value={fields.title}
            error={errors.title?.[0]}
            onChange={(value) => setField("title", value)}
          />
          <TextField
            id={`${formId}-company`}
            label={copy.companyLabel}
            value={fields.company}
            error={errors.company?.[0]}
            onChange={(value) => setField("company", value)}
          />
          <TextField
            id={`${formId}-email`}
            label={copy.emailLabel}
            value={fields.email}
            error={errors.email?.[0]}
            onChange={(value) => setField("email", value)}
            inputMode="email"
          />
          <TextField
            id={`${formId}-phone`}
            label={copy.phoneLabel}
            value={fields.phone}
            error={errors.phone?.[0]}
            onChange={(value) => setField("phone", value)}
            type="tel"
          />
          <TextField
            id={`${formId}-linkedin`}
            label={copy.linkedinLabel}
            value={fields.linkedinUrl}
            error={errors.linkedinUrl?.[0]}
            onChange={(value) => setField("linkedinUrl", value)}
            inputMode="url"
          />
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-notes`}>{copy.notesLabel}</Label>
            <Textarea
              id={`${formId}-notes`}
              value={fields.notes}
              onChange={(event) => setField("notes", event.target.value)}
              rows={4}
              aria-invalid={Boolean(errors.notes?.[0]) || notesOver}
              aria-describedby={`${formId}-notes-count`}
            />
            <p
              id={`${formId}-notes-count`}
              className={notesOver ? "text-xs text-destructive" : "text-xs text-slate"}
            >
              {copy.notesCount(fields.notes.length)}
            </p>
            {errors.notes?.[0] ? <FieldAlert message={errors.notes[0]} /> : null}
          </div>
          {showRole ? (
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-role`}>{copy.roleLabel}</Label>
              <Select
                value={role}
                onValueChange={(value) => {
                  if (isRole(value)) setRole(value);
                }}
              >
                <SelectTrigger
                  id={`${formId}-role`}
                  className="w-full"
                  aria-invalid={Boolean(errors.role?.[0])}
                >
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
              {errors.role?.[0] ? <FieldAlert message={errors.role[0]} /> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => begin(false)} disabled={pending}>
              {strings.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? copy.saving : strings.common.save}
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

function TextField({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  inputMode,
  maxLengthHint = false,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: "text" | "tel";
  inputMode?: "email" | "url";
  maxLengthHint?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error) || maxLengthHint}
      />
      {error ? <FieldAlert message={error} /> : null}
    </div>
  );
}

function FieldAlert({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
