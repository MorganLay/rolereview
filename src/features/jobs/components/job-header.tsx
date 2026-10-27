"use client";

import { useId, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Star } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { strings } from "@/copy/strings";
import { useUndoDelete } from "@/lib/use-undo-delete";
import { cn } from "@/lib/utils";
import type { FieldErrors } from "@/lib/result";

import type { LatestReadyResume } from "../next-action";
import { CloseJobDialog } from "./close-job-dialog";
import { AcceptedCelebration } from "./accepted-celebration";
import { JobNextActionLink } from "./job-next-action";
import {
  deleteJob,
  setJobArchived,
  setJobPriority,
  updateJobIdentity,
  updateJobStatus,
} from "../actions";
import {
  CLOSED_JOB_STATUSES,
  isClosedJobStatus,
  isJobStatus,
  OPEN_JOB_STATUSES,
  type JobStatusValue,
} from "../schemas";

const copy = strings.jobs.detail;

type JobHeaderProps = {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  status: JobStatusValue;
  archived: boolean;
  offerTabVisible: boolean;
  analysisReady: boolean;
  latestReadyResume: LatestReadyResume | null;
  hasOffer: boolean;
};

type HeaderOverlay = {
  title?: string;
  company?: string;
  location?: string | null;
  url?: string | null;
  status?: JobStatusValue;
  archived?: boolean;
};

function settledOverlay(overlay: HeaderOverlay, props: JobHeaderProps): HeaderOverlay {
  const next: HeaderOverlay = { ...overlay };
  if ("title" in next && next.title === props.title) delete next.title;
  if ("company" in next && next.company === props.company) delete next.company;
  if ("location" in next && next.location === props.location) delete next.location;
  if ("url" in next && next.url === props.url) delete next.url;
  if ("status" in next && next.status === props.status) delete next.status;
  if ("archived" in next && next.archived === props.archived) delete next.archived;
  return next;
}

function sameOverlay(a: HeaderOverlay, b: HeaderOverlay): boolean {
  const keys = new Set([
    ...(Object.keys(a) as (keyof HeaderOverlay)[]),
    ...(Object.keys(b) as (keyof HeaderOverlay)[]),
  ]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function JobHeader(props: JobHeaderProps) {
  const router = useRouter();
  const statusId = useId();
  const [overlay, setOverlay] = useState<HeaderOverlay>({});
  const settled = settledOverlay(overlay, props);
  if (!sameOverlay(settled, overlay)) setOverlay(settled);

  const title = settled.title ?? props.title;
  const company = settled.company ?? props.company;
  const location = "location" in settled ? (settled.location ?? null) : props.location;
  const url = "url" in settled ? (settled.url ?? null) : props.url;
  const status = settled.status ?? props.status;
  const archived = "archived" in settled ? settled.archived === true : props.archived;
  const [pending, setPending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<JobStatusValue | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [holdingDelete, setHoldingDelete] = useState(false);
  const { schedule } = useUndoDelete();
  const [acceptedOpen, setAcceptedOpen] = useState(false);

  function confirmDelete() {
    if (holdingDelete) return;
    setDeleteOpen(false);
    setHoldingDelete(true);
    schedule({
      id: props.jobId,
      message: copy.deleted,
      restore: () => setHoldingDelete(false),
      commit: async () => {
        try {
          const result = await deleteJob({ jobId: props.jobId });
          if (!result.ok) {
            toast.error(copy.deleteFailed);
            setHoldingDelete(false);
            return;
          }
          router.push("/jobs");
          router.refresh();
        } catch {
          toast.error(copy.deleteFailed);
          setHoldingDelete(false);
        }
      },
    });
  }

  function clearOverlay(key: keyof HeaderOverlay) {
    setOverlay((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function changeStatus(next: JobStatusValue, closeReason: string) {
    if (pending || next === status) return;
    setPending(true);
    setOverlay((current) => ({ ...current, status: next }));
    try {
      const result = await updateJobStatus({
        jobId: props.jobId,
        status: next,
        closeReason,
      });
      if (!result.ok) {
        clearOverlay("status");
        if (result.error.fields?.closeReason?.[0]) {
          return result.error.fields.closeReason[0];
        }
        toast.error(copy.updateFailed);
        setCloseOpen(false);
        return;
      }
      setCloseOpen(false);
      if (next === "ACCEPTED") setAcceptedOpen(true);
      router.refresh();
    } catch {
      clearOverlay("status");
      setCloseOpen(false);
      toast.error(copy.updateFailed);
    } finally {
      setPending(false);
    }
    return;
  }

  function onStatusChange(value: string) {
    if (!isJobStatus(value) || value === status || pending) return;
    if (isClosedJobStatus(value)) {
      setPendingStatus(value);
      setCloseOpen(true);
      return;
    }
    void changeStatus(value, "");
  }

  async function onArchive() {
    if (pending) return;
    const next = !archived;
    setPending(true);
    setOverlay((current) => ({ ...current, archived: next }));
    try {
      const result = await setJobArchived({
        jobId: props.jobId,
        archived: next,
      });
      if (!result.ok) {
        clearOverlay("archived");
        toast.error(copy.updateFailed);
        return;
      }
      toast.success(next ? copy.archivedToast : copy.unarchivedToast);
      router.refresh();
    } catch {
      clearOverlay("archived");
      toast.error(copy.updateFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold tracking-tight break-words text-ink md:text-3xl">
            {title}
          </h1>
          <p className="text-sm break-words text-slate">
            {location ? `${company} · ${location}` : company}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.actionsLabel}
              disabled={pending}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setEditOpen(true);
              }}
            >
              {copy.editDetails}
            </DropdownMenuItem>
            {props.offerTabVisible ? null : (
              <DropdownMenuItem
                onSelect={() => {
                  router.push(`/jobs/${props.jobId}?tab=offer`);
                }}
              >
                {copy.addOffer}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled={pending} onSelect={onArchive}>
              {archived ? copy.unarchive : copy.archive}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={holdingDelete}
              onSelect={() => setDeleteOpen(true)}
            >
              {strings.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {archived ? (
        <Badge variant="outline" className="h-auto w-fit whitespace-normal">
          {copy.archived}
        </Badge>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid w-full gap-2 sm:w-56">
          <Label htmlFor={statusId}>{copy.statusLabel}</Label>
          <Select value={status} onValueChange={onStatusChange} disabled={pending}>
            <SelectTrigger id={statusId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {OPEN_JOB_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {copy.statuses[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>{copy.closedGroup}</SelectLabel>
                {CLOSED_JOB_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {copy.statuses[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <JobNextActionLink
          input={{
            jobId: props.jobId,
            status,
            analysisReady: props.analysisReady,
            latestReadyResume: props.latestReadyResume,
            hasOffer: props.hasOffer,
          }}
          className="w-full sm:w-auto"
        />
      </div>

      <EditDetailsDialog
        open={editOpen}
        jobId={props.jobId}
        title={title}
        company={company}
        location={location}
        url={url}
        onOpenChange={setEditOpen}
        onSaved={(next) => {
          setOverlay((current) => ({
            ...current,
            title: next.title,
            company: next.company,
            location: next.location,
            url: next.url,
          }));
          router.refresh();
        }}
      />

      <CloseJobDialog
        open={closeOpen}
        status={pendingStatus}
        pending={pending}
        onOpenChange={(next) => {
          if (pending) return;
          setCloseOpen(next);
          if (!next) setPendingStatus(null);
        }}
        onConfirm={async (reason) => {
          if (!pendingStatus) return;
          const reasonError = await changeStatus(pendingStatus, reason);
          if (!reasonError) setPendingStatus(null);
          return reasonError;
        }}
      />

      <DeleteJobDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDelete={confirmDelete}
      />

      <AcceptedCelebration open={acceptedOpen} onOpenChange={setAcceptedOpen} />
    </header>
  );
}

export function JobPriority({
  jobId,
  priority: savedPriority,
}: {
  jobId: string;
  priority: number | null;
}) {
  const router = useRouter();
  const [overlay, setOverlay] = useState<number | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  if (overlay !== undefined && overlay === savedPriority) setOverlay(undefined);
  const priority = overlay !== undefined ? overlay : savedPriority;

  async function onPriority(n: number) {
    if (pending) return;
    const next = priority === n ? null : n;
    setPending(true);
    setOverlay(next);
    try {
      const result = await setJobPriority({ jobId, priority: next });
      if (!result.ok) {
        setOverlay(undefined);
        toast.error(copy.updateFailed);
        return;
      }
      router.refresh();
    } catch {
      setOverlay(undefined);
      toast.error(copy.updateFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <fieldset className="grid min-w-0 gap-2 border-0 p-0">
      <legend className="text-sm font-medium text-ink">{strings.jobs.priorityLabel}</legend>
      <div className="flex flex-wrap items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = priority !== null && n <= priority;
          return (
            <button
              key={n}
              type="button"
              disabled={pending}
              className="rounded-md p-1 text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              aria-pressed={priority === n}
              aria-label={
                priority === n ? strings.jobs.priorityClear : strings.jobs.prioritySet(n)
              }
              onClick={() => void onPriority(n)}
            >
              <Star
                aria-hidden
                className={cn("size-5", selected ? "fill-marigold text-ink" : "text-slate")}
              />
            </button>
          );
        })}
        <span className="ml-1 text-sm text-slate">
          {priority === null ? strings.jobs.priorityNone : strings.jobs.priorityValue(priority)}
        </span>
      </div>
    </fieldset>
  );
}

function EditDetailsDialog({
  open,
  jobId,
  title,
  company,
  location,
  url,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (next: {
    title: string;
    company: string;
    location: string | null;
    url: string | null;
  }) => void;
}) {
  const formId = useId();
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftCompany, setDraftCompany] = useState(company);
  const [draftLocation, setDraftLocation] = useState(location ?? "");
  const [draftUrl, setDraftUrl] = useState(url ?? "");
  const [fields, setFields] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setDraftTitle(title);
    setDraftCompany(company);
    setDraftLocation(location ?? "");
    setDraftUrl(url ?? "");
    setFields({});
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  function begin(next: boolean) {
    if (pending) return;
    if (next) {
      setDraftTitle(title);
      setDraftCompany(company);
      setDraftLocation(location ?? "");
      setDraftUrl(url ?? "");
      setFields({});
    }
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFields({});
    try {
      const result = await updateJobIdentity({
        jobId,
        title: draftTitle,
        company: draftCompany,
        location: draftLocation,
        url: draftUrl,
      });
      if (!result.ok) {
        if (result.error.code === "VALIDATION") {
          setFields(result.error.fields ?? {});
          return;
        }
        toast.error(copy.updateFailed);
        return;
      }
      toast.success(copy.savedDetails);
      onSaved({
        title: draftTitle.trim(),
        company: draftCompany.trim(),
        location: draftLocation.trim() || null,
        url: draftUrl.trim() || null,
      });
      onOpenChange(false);
    } catch {
      toast.error(copy.updateFailed);
    } finally {
      setPending(false);
    }
  }

  const titleError = fields.title?.[0];
  const companyError = fields.company?.[0];
  const locationError = fields.location?.[0];
  const urlError = fields.url?.[0];

  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogContent className="max-h-[min(40rem,calc(100%-2rem))] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">{copy.editTitle}</DialogTitle>
            <DialogDescription>{copy.editBody}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={`${formId}-title`}>{copy.titleLabel}</Label>
            <Input
              id={`${formId}-title`}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              required
              autoComplete="off"
              aria-invalid={Boolean(titleError)}
            />
            {titleError ? <FieldAlert message={titleError} /> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${formId}-company`}>{copy.companyLabel}</Label>
            <Input
              id={`${formId}-company`}
              value={draftCompany}
              onChange={(event) => setDraftCompany(event.target.value)}
              required
              autoComplete="off"
              aria-invalid={Boolean(companyError)}
            />
            {companyError ? <FieldAlert message={companyError} /> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${formId}-location`}>{copy.locationLabel}</Label>
            <Input
              id={`${formId}-location`}
              value={draftLocation}
              onChange={(event) => setDraftLocation(event.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(locationError)}
            />
            {locationError ? <FieldAlert message={locationError} /> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${formId}-url`}>{strings.jobs.urlLabel}</Label>
            <Input
              id={`${formId}-url`}
              type="text"
              inputMode="url"
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(urlError)}
              aria-describedby={`${formId}-url-hint`}
            />
            <p id={`${formId}-url-hint`} className="text-xs text-slate">
              {strings.jobs.urlHint}
            </p>
            {urlError ? <FieldAlert message={urlError} /> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => begin(false)}
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
  );
}

function DeleteJobDialog({
  open,
  onOpenChange,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  function onConfirm(event: MouseEvent) {
    event.preventDefault();
    onDelete();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-sans">{copy.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy.deleteBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{strings.common.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {strings.common.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FieldAlert({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
