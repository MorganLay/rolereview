"use client";

import { useState, useTransition, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { PROFILE_LIMITS } from "@/features/library/schemas";
import type { FieldErrors } from "@/lib/result";

import { updateProfile } from "../actions";
import type { LibraryProfile } from "../types";

type LinkDraft = {
  key: string;
  label: string;
  url: string;
};

type ProfileDialogProps = {
  profile: LibraryProfile;
};

const copy = strings.library.profile;

function draftsFromProfile(profile: LibraryProfile): LinkDraft[] {
  return profile.links.map((link) => ({
    key: crypto.randomUUID(),
    label: link.label,
    url: link.url,
  }));
}

function fieldMessage(fields: FieldErrors, key: string): string | undefined {
  return fields[key]?.[0];
}

export function ProfileDialog({ profile }: ProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [links, setLinks] = useState<LinkDraft[]>(() =>
    draftsFromProfile(profile),
  );
  const [fields, setFields] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function resetFromProfile() {
    setFullName(profile.fullName ?? "");
    setHeadline(profile.headline ?? "");
    setPhone(profile.phone ?? "");
    setLocation(profile.location ?? "");
    setSummary(profile.summary ?? "");
    setLinks(draftsFromProfile(profile));
    setFields({});
  }

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) resetFromProfile();
  }

  function updateLink(key: string, patch: Partial<Pick<LinkDraft, "label" | "url">>) {
    setLinks((current) =>
      current.map((link) => (link.key === key ? { ...link, ...patch } : link)),
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextLinks = links.filter(
      (link) => link.label.trim().length > 0 || link.url.trim().length > 0,
    );
    setLinks(nextLinks);
    setFields({});

    startTransition(async () => {
      const result = await updateProfile({
        fullName,
        headline,
        phone,
        location,
        summary,
        links: nextLinks.map(({ label, url }) => ({ label, url })),
      });

      if (!result.ok) {
        if (result.error.code === "VALIDATION" && result.error.fields) {
          setFields(result.error.fields);
          return;
        }
        toast.error(copy.saveFailed);
        return;
      }

      toast.success(copy.saved);
      setOpen(false);
    });
  }

  const atLinkLimit = links.length >= PROFILE_LIMITS.links;
  const summaryCount = `${summary.length.toLocaleString("en-US")} / ${PROFILE_LIMITS.summary.toLocaleString("en-US")}`;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(true)}>
        {copy.edit}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(40rem,calc(100%-2rem))] overflow-y-auto sm:max-w-lg">
          <form onSubmit={onSubmit} className="grid gap-4">
            <DialogHeader className="pr-8">
              <DialogTitle className="font-sans">{copy.title}</DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </DialogHeader>

            <Field
              id="profile-name"
              label={copy.name}
              error={fieldMessage(fields, "fullName")}
            >
              <Input
                id="profile-name"
                name="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={PROFILE_LIMITS.fullName}
                autoComplete="name"
                aria-invalid={Boolean(fieldMessage(fields, "fullName"))}
                aria-describedby={
                  fieldMessage(fields, "fullName") ? "profile-name-error" : undefined
                }
              />
            </Field>

            <Field
              id="profile-headline"
              label={copy.headline}
              hint={copy.headlineHint}
              error={fieldMessage(fields, "headline")}
            >
              <Input
                id="profile-headline"
                name="headline"
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                maxLength={PROFILE_LIMITS.headline}
                aria-invalid={Boolean(fieldMessage(fields, "headline"))}
                aria-describedby={
                  fieldMessage(fields, "headline")
                    ? "profile-headline-hint profile-headline-error"
                    : "profile-headline-hint"
                }
              />
            </Field>

            <Field
              id="profile-email"
              label={copy.email}
              hint={copy.emailHint}
            >
              <Input
                id="profile-email"
                name="email"
                type="email"
                value={profile.email}
                readOnly
                disabled
                autoComplete="email"
                aria-describedby="profile-email-hint"
              />
            </Field>

            <Field
              id="profile-phone"
              label={copy.phone}
              error={fieldMessage(fields, "phone")}
            >
              <Input
                id="profile-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={PROFILE_LIMITS.phone}
                autoComplete="tel"
                aria-invalid={Boolean(fieldMessage(fields, "phone"))}
                aria-describedby={
                  fieldMessage(fields, "phone") ? "profile-phone-error" : undefined
                }
              />
            </Field>

            <Field
              id="profile-location"
              label={copy.location}
              error={fieldMessage(fields, "location")}
            >
              <Input
                id="profile-location"
                name="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={PROFILE_LIMITS.location}
                aria-invalid={Boolean(fieldMessage(fields, "location"))}
                aria-describedby={
                  fieldMessage(fields, "location")
                    ? "profile-location-error"
                    : undefined
                }
              />
            </Field>

            <div className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="profile-links">{copy.links}</Label>
              </div>
              <p id="profile-links-hint" className="text-sm text-slate">
                {copy.linksHint}
              </p>
              {fieldMessage(fields, "links") ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldMessage(fields, "links")}
                </p>
              ) : null}
              <ul className="grid gap-3">
                {links.map((link, index) => {
                  const labelError = fieldMessage(fields, `links.${index}.label`);
                  const urlError = fieldMessage(fields, `links.${index}.url`);
                  return (
                    <li key={link.key} className="grid gap-2 rounded-lg border border-line p-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] sm:items-end">
                        <div className="grid gap-2">
                          <Label htmlFor={`profile-link-${link.key}-label`}>
                            {copy.linkLabel}
                          </Label>
                          <Input
                            id={`profile-link-${link.key}-label`}
                            value={link.label}
                            onChange={(event) =>
                              updateLink(link.key, { label: event.target.value })
                            }
                            maxLength={PROFILE_LIMITS.linkLabel}
                            aria-invalid={Boolean(labelError)}
                            aria-describedby={
                              labelError
                                ? `profile-link-${link.key}-label-error`
                                : undefined
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`profile-link-${link.key}-url`}>
                            {copy.linkUrl}
                          </Label>
                          <Input
                            id={`profile-link-${link.key}-url`}
                            value={link.url}
                            onChange={(event) =>
                              updateLink(link.key, { url: event.target.value })
                            }
                            inputMode="url"
                            placeholder={copy.linkUrlPlaceholder}
                            maxLength={PROFILE_LIMITS.linkUrl}
                            aria-invalid={Boolean(urlError)}
                            aria-describedby={
                              urlError
                                ? `profile-link-${link.key}-url-error`
                                : undefined
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setLinks((current) =>
                              current.filter((item) => item.key !== link.key),
                            )
                          }
                        >
                          {copy.removeLink}
                        </Button>
                      </div>
                      {labelError ? (
                        <p
                          id={`profile-link-${link.key}-label-error`}
                          className="text-sm text-destructive"
                          role="alert"
                        >
                          {labelError}
                        </p>
                      ) : null}
                      {urlError ? (
                        <p
                          id={`profile-link-${link.key}-url-error`}
                          className="text-sm text-destructive"
                          role="alert"
                        >
                          {urlError}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={atLinkLimit}
                  onClick={() =>
                    setLinks((current) => [
                      ...current,
                      { key: crypto.randomUUID(), label: "", url: "" },
                    ])
                  }
                >
                  {copy.addLink}
                </Button>
              </div>
            </div>

            <Field
              id="profile-summary"
              label={copy.summary}
              hint={copy.summaryHint}
              error={fieldMessage(fields, "summary")}
              extra={
                <p className="text-right text-xs text-slate tabular-nums">{summaryCount}</p>
              }
            >
              <Textarea
                id="profile-summary"
                name="summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                maxLength={PROFILE_LIMITS.summary}
                rows={6}
                aria-invalid={Boolean(fieldMessage(fields, "summary"))}
                aria-describedby={
                  fieldMessage(fields, "summary")
                    ? "profile-summary-hint profile-summary-count profile-summary-error"
                    : "profile-summary-hint profile-summary-count"
                }
              />
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                {strings.common.cancel}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? copy.saving : strings.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  extra,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {extra ? <div id={`${id}-count`}>{extra}</div> : null}
      </div>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-slate">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
