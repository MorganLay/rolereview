"use client";

import { useId, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import type { EntryKind } from "@/generated/prisma/client";
import {
  BULLET_LIMITS,
  ENTRY_KINDS,
  ENTRY_LIMITS,
  PROFILE_LIMITS,
  SKILL_LIMITS,
} from "@/features/library/schemas";
import type { FieldErrors } from "@/lib/result";

const copy = strings.library.import;
const profileCopy = strings.library.profile;
const entryCopy = strings.library.entries;
const bulletCopy = strings.library.bullets;
const skillCopy = strings.library.skills;

export type ReviewLink = { key: string; label: string; url: string };
export type ReviewBullet = { key: string; included: boolean; text: string };
export type ReviewEntry = {
  key: string;
  included: boolean;
  kind: EntryKind;
  title: string;
  organization: string;
  location: string;
  url: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  bullets: ReviewBullet[];
};
export type ReviewSkill = {
  key: string;
  included: boolean;
  name: string;
  category: string;
};
export type ReviewDraft = {
  profileIncluded: boolean;
  fullName: string;
  headline: string;
  phone: string;
  location: string;
  summary: string;
  links: ReviewLink[];
  resumeEmail: string | null;
  entries: ReviewEntry[];
  skills: ReviewSkill[];
  warnings: string[];
  mode: "append" | "replace";
};

type ReviewFormProps = {
  draft: ReviewDraft;
  setDraft: Dispatch<SetStateAction<ReviewDraft>>;
  email: string;
  libraryHasContent: boolean;
  fields: FieldErrors;
  formError: string | null;
  pending: boolean;
  onBack: () => void;
  onSave: () => Promise<boolean>;
};

function fieldMessage(fields: FieldErrors, key: string): string | undefined {
  return fields[key]?.[0];
}

function describedBy(id: string, hint: boolean, error: boolean): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(
    (value): value is string => value !== null,
  );
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function ReviewForm({
  draft,
  setDraft,
  email,
  libraryHasContent,
  fields,
  formError,
  pending,
  onBack,
  onSave,
}: ReviewFormProps) {
  const formId = useId();
  const [confirmReplace, setConfirmReplace] = useState(false);
  const formMessage = fieldMessage(fields, "form") ?? formError ?? undefined;
  const resumeEmail = draft.resumeEmail?.trim() ?? "";
  const emailDiffers =
    resumeEmail.length > 0 && resumeEmail.toLowerCase() !== email.trim().toLowerCase();

  function patchEntry(index: number, patch: Partial<ReviewEntry>) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function patchBullet(
    entryIndex: number,
    bulletIndex: number,
    patch: Partial<ReviewBullet>,
  ) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, index) => {
        if (index !== entryIndex) return entry;
        return {
          ...entry,
          bullets: entry.bullets.map((bullet, indexInEntry) =>
            indexInEntry === bulletIndex ? { ...bullet, ...patch } : bullet,
          ),
        };
      }),
    }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (libraryHasContent && draft.mode === "replace") {
      setConfirmReplace(true);
      return;
    }
    void onSave();
  }

  async function confirmReplaceSave() {
    const saved = await onSave();
    if (!saved) setConfirmReplace(false);
  }

  const grouped = ENTRY_KINDS.map((kind) => ({
    kind,
    entries: draft.entries
      .map((entry, index) => ({ entry, index }))
      .filter((item) => item.entry.kind === kind),
  })).filter((group) => group.entries.length > 0);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {draft.warnings.length > 0 ? (
        <section className="rounded-lg bg-marigold-100 px-4 py-3" aria-labelledby={`${formId}-warnings`}>
          <h2 id={`${formId}-warnings`} className="text-sm font-medium text-ink">
            {copy.warningsTitle}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
            {draft.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-slate">{copy.reviewHint}</p>

      <section className="flex flex-col gap-4 rounded-lg border border-line p-4" aria-labelledby={`${formId}-profile`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={`${formId}-profile`} className="text-base font-medium text-ink">
            {copy.profileTitle}
          </h2>
          <IncludeBox
            id={`${formId}-profile-include`}
            checked={draft.profileIncluded}
            label={`${copy.include} ${copy.profileTitle}`}
            onChange={(included) =>
              setDraft((current) => ({ ...current, profileIncluded: included }))
            }
          />
        </div>
        <p className="text-sm text-slate">{copy.profileSkip}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={`${formId}-name`}
            label={profileCopy.name}
            value={draft.fullName}
            maxLength={PROFILE_LIMITS.fullName}
            autoComplete="name"
            error={fieldMessage(fields, "profile.fullName")}
            onChange={(fullName) => setDraft((current) => ({ ...current, fullName }))}
          />
          <TextField
            id={`${formId}-headline`}
            label={profileCopy.headline}
            hint={profileCopy.headlineHint}
            value={draft.headline}
            maxLength={PROFILE_LIMITS.headline}
            error={fieldMessage(fields, "profile.headline")}
            onChange={(headline) => setDraft((current) => ({ ...current, headline }))}
          />
          <TextField
            id={`${formId}-phone`}
            label={profileCopy.phone}
            value={draft.phone}
            maxLength={PROFILE_LIMITS.phone}
            autoComplete="tel"
            error={fieldMessage(fields, "profile.phone")}
            onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
          />
          <TextField
            id={`${formId}-location`}
            label={profileCopy.location}
            value={draft.location}
            maxLength={PROFILE_LIMITS.location}
            autoComplete="address-level2"
            error={fieldMessage(fields, "profile.location")}
            onChange={(location) => setDraft((current) => ({ ...current, location }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${formId}-email`}>{profileCopy.email}</Label>
          <p id={`${formId}-email-hint`} className="text-sm text-slate">
            {profileCopy.emailHint}
          </p>
          <Input
            id={`${formId}-email`}
            value={email}
            readOnly
            disabled
            autoComplete="email"
            aria-describedby={
              emailDiffers ? `${formId}-email-hint ${formId}-email-diff` : `${formId}-email-hint`
            }
          />
          {emailDiffers ? (
            <p id={`${formId}-email-diff`} className="text-sm text-slate">
              {copy.emailDiffers(resumeEmail)}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${formId}-summary`}>{profileCopy.summary}</Label>
          <p id={`${formId}-summary-hint`} className="text-sm text-slate">
            {profileCopy.summaryHint}
          </p>
          <Textarea
            id={`${formId}-summary`}
            value={draft.summary}
            maxLength={PROFILE_LIMITS.summary}
            onChange={(event) =>
              setDraft((current) => ({ ...current, summary: event.target.value }))
            }
            aria-invalid={Boolean(fieldMessage(fields, "profile.summary"))}
            aria-describedby={describedBy(
              `${formId}-summary`,
              true,
              Boolean(fieldMessage(fields, "profile.summary")),
            )}
          />
          {fieldMessage(fields, "profile.summary") ? (
            <p id={`${formId}-summary-error`} className="text-sm text-destructive" role="alert">
              {fieldMessage(fields, "profile.summary")}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>{profileCopy.links}</Label>
          <p className="text-sm text-slate">{profileCopy.linksHint}</p>
          {fieldMessage(fields, "profile.links") ? (
            <p className="text-sm text-destructive" role="alert">
              {fieldMessage(fields, "profile.links")}
            </p>
          ) : null}
          <ul className="grid gap-3">
            {draft.links.map((link, index) => (
              <li key={link.key} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-2">
                <TextField
                  id={`${formId}-link-${index}-label`}
                  label={profileCopy.linkLabel}
                  value={link.label}
                  maxLength={PROFILE_LIMITS.linkLabel}
                  error={fieldMessage(fields, `profile.links.${index}.label`)}
                  onChange={(label) =>
                    setDraft((current) => ({
                      ...current,
                      links: current.links.map((item) =>
                        item.key === link.key ? { ...item, label } : item,
                      ),
                    }))
                  }
                />
                <TextField
                  id={`${formId}-link-${index}-url`}
                  label={profileCopy.linkUrl}
                  value={link.url}
                  maxLength={PROFILE_LIMITS.linkUrl}
                  error={fieldMessage(fields, `profile.links.${index}.url`)}
                  onChange={(url) =>
                    setDraft((current) => ({
                      ...current,
                      links: current.links.map((item) =>
                        item.key === link.key ? { ...item, url } : item,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-self-start"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      links: current.links.filter((item) => item.key !== link.key),
                    }))
                  }
                >
                  {profileCopy.removeLink}
                </Button>
              </li>
            ))}
          </ul>
          {draft.links.length < PROFILE_LIMITS.links ? (
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  links: [
                    ...current.links,
                    { key: crypto.randomUUID(), label: "", url: "" },
                  ],
                }))
              }
            >
              {profileCopy.addLink}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-label={copy.entriesTitle}>
        {grouped.length === 0 ? <p className="text-sm text-slate">{copy.noEntries}</p> : null}
        {grouped.map((group) => (
          <div key={group.kind} className="flex flex-col gap-3">
            <h2 className="text-base font-medium text-ink">
              {entryCopy.kinds[group.kind].title}
            </h2>
            {group.entries.map(({ entry, index }) => {
              const kindCopy = entryCopy.kinds[entry.kind];
              const titleError = fieldMessage(fields, `entries.${index}.title`);
              return (
                <article key={entry.key} className="flex flex-col gap-4 rounded-lg border border-line p-4">
                  <IncludeBox
                    id={`${formId}-entry-${index}-include`}
                    checked={entry.included}
                    label={`${copy.include} ${entry.title || kindCopy.title}`}
                    onChange={(included) => patchEntry(index, { included })}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id={`${formId}-entry-${index}-title`}
                      label={kindCopy.titleLabel}
                      value={entry.title}
                      maxLength={ENTRY_LIMITS.title}
                      error={titleError}
                      onChange={(title) => patchEntry(index, { title })}
                    />
                    <TextField
                      id={`${formId}-entry-${index}-org`}
                      label={kindCopy.organizationLabel}
                      value={entry.organization}
                      maxLength={ENTRY_LIMITS.organization}
                      error={fieldMessage(fields, `entries.${index}.organization`)}
                      onChange={(organization) => patchEntry(index, { organization })}
                    />
                    <TextField
                      id={`${formId}-entry-${index}-location`}
                      label={entryCopy.location}
                      value={entry.location}
                      maxLength={ENTRY_LIMITS.location}
                      error={fieldMessage(fields, `entries.${index}.location`)}
                      onChange={(location) => patchEntry(index, { location })}
                    />
                    <TextField
                      id={`${formId}-entry-${index}-url`}
                      label={entryCopy.url}
                      value={entry.url}
                      maxLength={ENTRY_LIMITS.url}
                      error={fieldMessage(fields, `entries.${index}.url`)}
                      onChange={(url) => patchEntry(index, { url })}
                    />
                    <TextField
                      id={`${formId}-entry-${index}-start`}
                      label={entryCopy.start}
                      hint={copy.dateHint}
                      value={entry.startDate}
                      error={fieldMessage(fields, `entries.${index}.startDate`)}
                      onChange={(startDate) => patchEntry(index, { startDate })}
                    />
                    {entry.isCurrent ? null : (
                      <TextField
                        id={`${formId}-entry-${index}-end`}
                        label={entryCopy.end}
                        hint={copy.dateHint}
                        value={entry.endDate}
                        error={fieldMessage(fields, `entries.${index}.endDate`)}
                        onChange={(endDate) => patchEntry(index, { endDate })}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`${formId}-entry-${index}-current`}
                      checked={entry.isCurrent}
                      onCheckedChange={(checked) =>
                        patchEntry(index, {
                          isCurrent: checked === true,
                          endDate: checked === true ? "" : entry.endDate,
                        })
                      }
                    />
                    <Label htmlFor={`${formId}-entry-${index}-current`}>{kindCopy.current}</Label>
                  </div>
                  <ul className="grid gap-3">
                    {entry.bullets.map((bullet, bulletIndex) => {
                      const bulletId = `${formId}-entry-${index}-bullet-${bulletIndex}`;
                      const tooLong = bullet.text.trim().length > BULLET_LIMITS.text;
                      const bulletError = fieldMessage(
                        fields,
                        `entries.${index}.bullets.${bulletIndex}.text`,
                      );
                      return (
                        <li key={bullet.key} className="grid gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Label htmlFor={bulletId}>{bulletCopy.label}</Label>
                            <IncludeBox
                              id={`${bulletId}-include`}
                              checked={bullet.included}
                              label={`${copy.include} ${bulletCopy.label}`}
                              onChange={(included) =>
                                patchBullet(index, bulletIndex, { included })
                              }
                            />
                          </div>
                          <Textarea
                            id={bulletId}
                            value={bullet.text}
                            onChange={(event) =>
                              patchBullet(index, bulletIndex, { text: event.target.value })
                            }
                            aria-invalid={Boolean(bulletError) || tooLong}
                            aria-describedby={[
                              `${bulletId}-count`,
                              tooLong ? `${bulletId}-long` : null,
                              bulletError ? `${bulletId}-error` : null,
                            ]
                              .filter((value) => value !== null)
                              .join(" ")}
                          />
                          <p id={`${bulletId}-count`} className="text-sm text-slate tabular-nums">
                            {bulletCopy.count(bullet.text.length, BULLET_LIMITS.text)}
                          </p>
                          {tooLong ? (
                            <p id={`${bulletId}-long`} className="text-sm text-marigold-700">
                              {copy.longBullet}
                            </p>
                          ) : null}
                          {bulletError ? (
                            <p id={`${bulletId}-error`} className="text-sm text-destructive" role="alert">
                              {bulletError}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby={`${formId}-skills`}>
        <h2 id={`${formId}-skills`} className="text-base font-medium text-ink">
          {skillCopy.title}
        </h2>
        {draft.skills.length === 0 ? <p className="text-sm text-slate">{copy.noSkills}</p> : null}
        <ul className="grid gap-3">
          {draft.skills.map((skill, index) => (
            <li key={skill.key} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
              <IncludeBox
                id={`${formId}-skill-${index}-include`}
                checked={skill.included}
                label={`${copy.include} ${skill.name || skillCopy.name}`}
                onChange={(included) =>
                  setDraft((current) => ({
                    ...current,
                    skills: current.skills.map((item) =>
                      item.key === skill.key ? { ...item, included } : item,
                    ),
                  }))
                }
              />
              <TextField
                id={`${formId}-skill-${index}-name`}
                label={skillCopy.name}
                value={skill.name}
                maxLength={SKILL_LIMITS.name}
                error={fieldMessage(fields, `skills.${index}.name`)}
                onChange={(name) =>
                  setDraft((current) => ({
                    ...current,
                    skills: current.skills.map((item) =>
                      item.key === skill.key ? { ...item, name } : item,
                    ),
                  }))
                }
              />
              <TextField
                id={`${formId}-skill-${index}-category`}
                label={skillCopy.category}
                hint={skillCopy.categoryHint}
                value={skill.category}
                maxLength={SKILL_LIMITS.category}
                error={fieldMessage(fields, `skills.${index}.category`)}
                onChange={(category) =>
                  setDraft((current) => ({
                    ...current,
                    skills: current.skills.map((item) =>
                      item.key === skill.key ? { ...item, category } : item,
                    ),
                  }))
                }
              />
            </li>
          ))}
        </ul>
      </section>

      {libraryHasContent ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-ink">{copy.modeLabel}</legend>
          <ModeOption
            name={`${formId}-mode`}
            value="append"
            current={draft.mode}
            label={copy.append}
            hint={copy.appendHint}
            onChange={() => setDraft((current) => ({ ...current, mode: "append" }))}
          />
          <ModeOption
            name={`${formId}-mode`}
            value="replace"
            current={draft.mode}
            label={copy.replace}
            hint={copy.replaceHint}
            onChange={() => setDraft((current) => ({ ...current, mode: "replace" }))}
          />
        </fieldset>
      ) : null}

      {formMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {formMessage}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
          {copy.startOver}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? copy.saving : copy.save}
        </Button>
      </div>

      <AlertDialog
        open={confirmReplace}
        onOpenChange={(open) => {
          if (!pending) setConfirmReplace(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.replaceTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.replaceBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{strings.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void confirmReplaceSave();
              }}
            >
              {pending ? copy.saving : copy.replaceConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function IncludeBox({
  id,
  checked,
  label,
  onChange,
}: {
  id: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        aria-label={label}
      />
      <Label htmlFor={id}>{copy.include}</Label>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  maxLength,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-slate">
          {hint}
        </p>
      ) : null}
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, Boolean(hint), Boolean(error))}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ModeOption({
  name,
  value,
  current,
  label,
  hint,
  onChange,
}: {
  name: string;
  value: ReviewDraft["mode"];
  current: ReviewDraft["mode"];
  label: string;
  hint: string;
  onChange: () => void;
}) {
  const id = `${name}-${value}`;
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        onChange={onChange}
        className="mt-1 accent-pine"
      />
      <Label htmlFor={id} className="grid gap-0.5 font-normal">
        <span className="text-sm text-ink">{label}</span>
        <span className="text-sm font-normal text-slate">{hint}</span>
      </Label>
    </div>
  );
}
