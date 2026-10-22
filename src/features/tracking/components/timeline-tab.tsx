"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Calendar,
  CalendarCheck,
  Circle,
  FileText,
  Handshake,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Reply,
  Send,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

import { createTimelineEvent, updateTimelineEvent } from "../actions";
import {
  isManualEventType,
  MANUAL_EVENT_TYPES,
  visibleTimelineEvents,
  type ManualEventType,
  type TimelineEventView,
} from "../events";
import { EVENT_LIMITS } from "../schemas";

const copy = strings.jobs.timeline;
const detail = strings.jobs.detail;

const eventIcons: Record<TimelineEventView["type"], LucideIcon> = {
  CREATED: Plus,
  STATUS_CHANGED: ArrowRightLeft,
  RESUME_TAILORED: FileText,
  LETTER_WRITTEN: Mail,
  APPLIED: Send,
  FOLLOW_UP_SENT: Reply,
  RESPONSE_RECEIVED: MessageSquare,
  INTERVIEW_SCHEDULED: Calendar,
  INTERVIEW_COMPLETED: CalendarCheck,
  OFFER_RECEIVED: Handshake,
  CALL: Phone,
  EMAIL: Mail,
  NOTE: StickyNote,
  OTHER: Circle,
};

type DialogMode =
  | { kind: "add" }
  | { kind: "edit"; event: TimelineEventView; type: ManualEventType };

export function TimelineTab({
  jobId,
  events,
  hideAuto,
  today,
  contacts,
}: {
  jobId: string;
  events: TimelineEventView[];
  hideAuto: boolean;
  today: string;
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const hideId = useId();
  const [pendingNav, startNav] = useTransition();
  const [mode, setMode] = useState<DialogMode | null>(null);
  const visible = visibleTimelineEvents(events, hideAuto);

  function onHide(checked: boolean) {
    const params = new URLSearchParams();
    params.set("tab", "timeline");
    if (checked) params.set("events", "manual");
    startNav(() => {
      router.replace(`/jobs/${jobId}?${params}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id={hideId}
            checked={hideAuto}
            disabled={pendingNav}
            onCheckedChange={(checked) => onHide(checked === true)}
          />
          <Label htmlFor={hideId}>{copy.hideAuto}</Label>
        </div>
        <Button type="button" onClick={() => setMode({ kind: "add" })}>
          {copy.addEntry}
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate">{hideAuto ? copy.emptyManual : copy.empty}</p>
      ) : (
        <ol aria-label={copy.listLabel} className="flex flex-col">
          {visible.map((event) => {
            const Icon = eventIcons[event.type];
            const change = statusLine(event);
            const manualType = isManualEventType(event.type) ? event.type : null;
            return (
              <li
                key={event.id}
                className="flex gap-3 border-b border-line py-3 last:border-b-0"
              >
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-slate" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium break-words text-ink">
                      {copy.types[event.type]}
                    </p>
                    {manualType ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setMode({ kind: "edit", event, type: manualType })
                        }
                      >
                        {strings.common.edit}
                      </Button>
                    ) : null}
                  </div>
                  {change ? <p className="text-sm text-ink">{change}</p> : null}
                  {event.contactName ? (
                    <p className="text-sm break-words text-ink">
                      {copy.withContact(event.contactName)}
                    </p>
                  ) : null}
                  {event.details ? (
                    <p className="text-sm break-words whitespace-pre-wrap text-ink">
                      {event.details}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate">
                    <time dateTime={event.manual ? event.date : event.occurredAt}>
                      {event.whenLabel}
                    </time>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <EventDialog
        jobId={jobId}
        mode={mode}
        today={today}
        contacts={contacts}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
      />
    </div>
  );
}

function contactChoices(
  contacts: { id: string; name: string }[],
  mode: DialogMode | null,
): { id: string; name: string }[] {
  if (mode?.kind !== "edit" || !mode.event.contactId) return contacts;
  if (contacts.some((contact) => contact.id === mode.event.contactId)) return contacts;
  return [
    { id: mode.event.contactId, name: mode.event.contactName ?? mode.event.contactId },
    ...contacts,
  ];
}

function statusLine(event: TimelineEventView): string | null {
  if (!event.fromStatus || !event.toStatus) return null;
  return copy.statusTo(detail.statuses[event.fromStatus], detail.statuses[event.toStatus]);
}

const NO_CONTACT = "none";

function EventDialog({
  jobId,
  mode,
  today,
  contacts,
  onOpenChange,
}: {
  jobId: string;
  mode: DialogMode | null;
  today: string;
  contacts: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const formId = useId();
  const open = mode !== null;
  const [wasOpen, setWasOpen] = useState(false);
  const [type, setType] = useState<ManualEventType | "">("");
  const [date, setDate] = useState(today);
  const [details, setDetails] = useState("");
  const [contactId, setContactId] = useState(NO_CONTACT);
  const [fields, setFields] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  if (mode && !wasOpen) {
    setWasOpen(true);
    setFields({});
    setPending(false);
    if (mode.kind === "edit") {
      setType(mode.type);
      setDate(mode.event.date);
      setDetails(mode.event.details ?? "");
      setContactId(mode.event.contactId ?? NO_CONTACT);
    } else {
      setType("");
      setDate(today);
      setDetails("");
      setContactId(NO_CONTACT);
    }
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  function begin(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || !mode) return;
    setPending(true);
    setFields({});
    const payload = {
      jobId,
      type,
      date,
      details,
      contactId: type === "FOLLOW_UP_SENT" && contactId !== NO_CONTACT ? contactId : "",
    };
    const result =
      mode.kind === "edit"
        ? await updateTimelineEvent({ ...payload, eventId: mode.event.id })
        : await createTimelineEvent(payload);
    setPending(false);
    if (!result.ok) {
      if (result.error.code === "VALIDATION" && result.error.fields) {
        setFields(result.error.fields);
        const shown = ["type", "date", "details", "contactId"].some(
          (key) => result.error.fields?.[key]?.[0],
        );
        if (shown) return;
      }
      if (result.error.code === "NOT_FOUND") {
        toast.error(copy.notFound);
        return;
      }
      if (result.error.code === "CONFLICT") {
        toast.error(copy.locked);
        return;
      }
      toast.error(copy.saveFailed);
      return;
    }
    toast.success(mode.kind === "edit" ? copy.updated : copy.added);
    onOpenChange(false);
    router.refresh();
  }

  const detailsOver = details.length > EVENT_LIMITS.details;
  const typeError = fields.type?.[0];
  const dateError = fields.date?.[0];
  const detailsError = fields.details?.[0];
  const contactError = fields.contactId?.[0];
  const followUp = type === "FOLLOW_UP_SENT";
  const contactOptions = contactChoices(contacts, mode);

  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">
              {mode?.kind === "edit" ? copy.dialogEditTitle : copy.dialogAddTitle}
            </DialogTitle>
            <DialogDescription>{copy.dialogBody}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-type`}>{copy.typeLabel}</Label>
            <Select
              value={type || undefined}
              onValueChange={(value) => {
                if (isManualEventType(value)) setType(value);
              }}
            >
              <SelectTrigger
                id={`${formId}-type`}
                className="w-full"
                aria-invalid={Boolean(typeError)}
              >
                <SelectValue placeholder={copy.typePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_EVENT_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {copy.types[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeError ? <FieldAlert message={typeError} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-date`}>{copy.dateLabel}</Label>
            <Input
              id={`${formId}-date`}
              type="date"
              min="1900-01-01"
              max="2099-12-31"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-invalid={Boolean(dateError)}
            />
            {dateError ? <FieldAlert message={dateError} /> : null}
          </div>
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
          </div>
          {followUp ? (
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-contact`}>{copy.contactLabel}</Label>
              {contactOptions.length === 0 ? (
                <p className="text-sm text-slate">{copy.contactEmpty}</p>
              ) : (
                <>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger
                      id={`${formId}-contact`}
                      className="w-full"
                      aria-invalid={Boolean(contactError)}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CONTACT}>{copy.contactNone}</SelectItem>
                      {contactOptions.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate">{copy.contactHint}</p>
                </>
              )}
              {contactError ? <FieldAlert message={contactError} /> : null}
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

function FieldAlert({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
