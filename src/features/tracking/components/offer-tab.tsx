"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { EMPTY_CHOICE, PAY_PERIODS } from "@/features/jobs/schemas";
import type { FieldErrors } from "@/lib/result";

import { saveOffer } from "../actions";
import {
  OFFER_DECISIONS,
  OFFER_LIMITS,
  type OfferDecision,
  type OfferView,
} from "../offers";

const copy = strings.jobs.offer;

type OfferDraft = {
  baseSalary: string;
  currency: string;
  payPeriod: string;
  bonus: string;
  equity: string;
  benefits: string;
  startDate: string;
  respondBy: string;
  decision: OfferDecision;
  notes: string;
};

function draftFrom(offer: OfferView | null): OfferDraft {
  return {
    baseSalary: offer?.baseSalary ?? "",
    currency: offer?.currency ?? "",
    payPeriod: offer?.payPeriod ?? EMPTY_CHOICE,
    bonus: offer?.bonus ?? "",
    equity: offer?.equity ?? "",
    benefits: offer?.benefits ?? "",
    startDate: offer?.startDate ?? "",
    respondBy: offer?.respondBy ?? "",
    decision: offer?.decision ?? "PENDING",
    notes: offer?.notes ?? "",
  };
}

function sameDraft(a: OfferDraft, b: OfferDraft): boolean {
  return (Object.keys(a) as (keyof OfferDraft)[]).every((key) => a[key] === b[key]);
}

function isDecision(value: string): value is OfferDecision {
  return (OFFER_DECISIONS as readonly string[]).includes(value);
}

export function OfferTab({ jobId, offer }: { jobId: string; offer: OfferView | null }) {
  const router = useRouter();
  const formId = useId();
  const initial = draftFrom(offer);
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const incoming = JSON.stringify(draftFrom(offer));
  const [seen, setSeen] = useState(incoming);

  if (incoming !== seen) {
    setSeen(incoming);
    if (sameDraft(draft, saved)) {
      const next = draftFrom(offer);
      setDraft(next);
      setSaved(next);
    }
  }

  function update(patch: Partial<OfferDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setFields({});
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const payload = draft;
    setPending(true);
    setFields({});
    try {
      const result = await saveOffer({
        jobId,
        baseSalary: payload.baseSalary,
        currency: payload.currency,
        payPeriod: payload.payPeriod,
        bonus: payload.bonus,
        equity: payload.equity,
        benefits: payload.benefits,
        startDate: payload.startDate,
        respondBy: payload.respondBy,
        decision: payload.decision,
        notes: payload.notes,
      });
      if (!result.ok) {
        if (result.error.code === "VALIDATION") {
          setFields(result.error.fields ?? {});
          return;
        }
        if (result.error.code === "NOT_FOUND") {
          toast.error(copy.notFound);
          return;
        }
        if (result.error.code === "CONFLICT") {
          toast.error(copy.conflict);
          router.refresh();
          return;
        }
        toast.error(copy.saveFailed);
        return;
      }
      setSaved(payload);
      toast.success(copy.saved);
      router.refresh();
    } catch {
      toast.error(copy.saveFailed);
    } finally {
      setPending(false);
    }
  }

  const benefitsOver = draft.benefits.length > OFFER_LIMITS.benefits;
  const notesOver = draft.notes.length > OFFER_LIMITS.notes;
  const bonusOver = draft.bonus.length > OFFER_LIMITS.bonus;
  const equityOver = draft.equity.length > OFFER_LIMITS.equity;

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} aria-busy={pending}>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-ink">{copy.tab}</h2>
        <p className="text-sm text-slate">{copy.intro}</p>
        <p className="text-xs text-slate">{copy.hint}</p>
        <p aria-live="polite" className="min-h-4 text-xs text-slate">
          {pending ? copy.saving : ""}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-base`}>{copy.baseLabel}</Label>
          <Input
            id={`${formId}-base`}
            inputMode="numeric"
            value={draft.baseSalary}
            onChange={(event) => update({ baseSalary: event.target.value })}
            autoComplete="off"
            disabled={pending}
            aria-invalid={Boolean(fields.baseSalary?.[0])}
          />
          {fields.baseSalary?.[0] ? <FieldAlert message={fields.baseSalary[0]} /> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-currency`}>{copy.currencyLabel}</Label>
          <Input
            id={`${formId}-currency`}
            value={draft.currency}
            onChange={(event) => update({ currency: event.target.value })}
            onBlur={(event) =>
              update({ currency: event.target.value.trim().toUpperCase() })
            }
            autoComplete="off"
            disabled={pending}
            aria-invalid={Boolean(fields.currency?.[0])}
            aria-describedby={`${formId}-currency-hint`}
          />
          <p id={`${formId}-currency-hint`} className="text-xs text-slate">
            {copy.currencyHint}
          </p>
          {fields.currency?.[0] ? <FieldAlert message={fields.currency[0]} /> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-period`}>{copy.periodLabel}</Label>
          <Select
            value={draft.payPeriod}
            onValueChange={(value) => update({ payPeriod: value })}
            disabled={pending}
          >
            <SelectTrigger
              id={`${formId}-period`}
              className="w-full"
              aria-invalid={Boolean(fields.payPeriod?.[0])}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_CHOICE}>{copy.periodNone}</SelectItem>
              {PAY_PERIODS.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.periods[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fields.payPeriod?.[0] ? <FieldAlert message={fields.payPeriod[0]} /> : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <CountedField
          id={`${formId}-bonus`}
          label={copy.bonusLabel}
          value={draft.bonus}
          count={copy.shortCount(draft.bonus.length)}
          over={bonusOver}
          error={fields.bonus?.[0]}
          disabled={pending}
          onChange={(bonus) => update({ bonus })}
        />
        <CountedField
          id={`${formId}-equity`}
          label={copy.equityLabel}
          value={draft.equity}
          count={copy.shortCount(draft.equity.length)}
          over={equityOver}
          error={fields.equity?.[0]}
          disabled={pending}
          onChange={(equity) => update({ equity })}
        />
      </div>

      <CountedArea
        id={`${formId}-benefits`}
        label={copy.benefitsLabel}
        value={draft.benefits}
        count={copy.longCount(draft.benefits.length)}
        over={benefitsOver}
        error={fields.benefits?.[0]}
        disabled={pending}
        onChange={(benefits) => update({ benefits })}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-start`}>{copy.startLabel}</Label>
          <Input
            id={`${formId}-start`}
            type="date"
            min="1900-01-01"
            max="2099-12-31"
            value={draft.startDate}
            onChange={(event) => update({ startDate: event.target.value })}
            disabled={pending}
            aria-invalid={Boolean(fields.startDate?.[0])}
            aria-describedby={`${formId}-start-hint`}
          />
          <p id={`${formId}-start-hint`} className="text-xs text-slate">
            {copy.startHint}
          </p>
          {fields.startDate?.[0] ? <FieldAlert message={fields.startDate[0]} /> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-respond`}>{copy.respondByLabel}</Label>
          <Input
            id={`${formId}-respond`}
            type="date"
            min="1900-01-01"
            max="2099-12-31"
            value={draft.respondBy}
            onChange={(event) => update({ respondBy: event.target.value })}
            disabled={pending}
            aria-invalid={Boolean(fields.respondBy?.[0])}
            aria-describedby={`${formId}-respond-hint`}
          />
          <p id={`${formId}-respond-hint`} className="text-xs text-slate">
            {copy.respondByHint}
          </p>
          {fields.respondBy?.[0] ? <FieldAlert message={fields.respondBy[0]} /> : null}
        </div>
      </div>

      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor={`${formId}-decision`}>{copy.decisionLabel}</Label>
        <Select
          value={draft.decision}
          onValueChange={(value) => {
            if (isDecision(value)) update({ decision: value });
          }}
          disabled={pending}
        >
          <SelectTrigger
            id={`${formId}-decision`}
            className="w-full"
            aria-invalid={Boolean(fields.decision?.[0])}
            aria-describedby={`${formId}-decision-hint`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OFFER_DECISIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {copy.decisions[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p id={`${formId}-decision-hint`} className="text-xs text-slate">
          {copy.decisionHint}
        </p>
        {fields.decision?.[0] ? <FieldAlert message={fields.decision[0]} /> : null}
      </div>

      <CountedArea
        id={`${formId}-notes`}
        label={copy.notesLabel}
        value={draft.notes}
        count={copy.longCount(draft.notes.length)}
        over={notesOver}
        error={fields.notes?.[0]}
        disabled={pending}
        onChange={(notes) => update({ notes })}
      />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? copy.saving : copy.save}
        </Button>
      </div>
    </form>
  );
}

function CountedField({
  id,
  label,
  value,
  count,
  over,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  count: string;
  over: boolean;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        disabled={disabled}
        aria-invalid={Boolean(error) || over}
        aria-describedby={`${id}-count`}
      />
      <p id={`${id}-count`} className={over ? "text-xs text-destructive" : "text-xs text-slate"}>
        {count}
      </p>
      {error ? <FieldAlert message={error} /> : null}
    </div>
  );
}

function CountedArea({
  id,
  label,
  value,
  count,
  over,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  count: string;
  over: boolean;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        disabled={disabled}
        aria-invalid={Boolean(error) || over}
        aria-describedby={`${id}-count`}
      />
      <p id={`${id}-count`} className={over ? "text-xs text-destructive" : "text-xs text-slate"}>
        {count}
      </p>
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
