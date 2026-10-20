"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { strings } from "@/copy/strings";

import { archiveJobs, updateJobStatus } from "../actions";
import type { JobListDisplay } from "../format";
import {
  jobListHref,
  toggledSort,
  type JobListQuery,
  type JobListSort,
} from "../list-params";
import {
  ARCHIVE_JOBS_MAX,
  CLOSED_JOB_STATUSES,
  isClosedJobStatus,
  isJobStatus,
  OPEN_JOB_STATUSES,
  type JobStatusValue,
} from "../schemas";
import { CloseJobDialog } from "./close-job-dialog";

const copy = strings.jobs.board;
const detail = strings.jobs.detail;

const columns: { key: JobListSort; label: string }[] = [
  { key: "company", label: copy.columns.company },
  { key: "title", label: copy.columns.title },
  { key: "status", label: copy.columns.status },
  { key: "priority", label: copy.columns.priority },
  { key: "match", label: copy.columns.match },
  { key: "applied", label: copy.columns.applied },
  { key: "activity", label: copy.columns.activity },
  { key: "deadline", label: copy.columns.deadline },
];

export function JobsTable({
  query,
  rows,
}: {
  query: JobListQuery;
  rows: JobListDisplay[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [closeTarget, setCloseTarget] = useState<{
    jobId: string;
    status: JobStatusValue;
  } | null>(null);

  const selectedIds = rows.filter((row) => selected.has(row.id)).map((row) => row.id);
  const selectedRows = rows.filter((row) => selected.has(row.id));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  const busy = bulkPending || pendingId !== null;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((row) => row.id)) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function onStatusChange(row: JobListDisplay, value: string) {
    if (!isJobStatus(value) || value === row.status || busy) return;
    if (isClosedJobStatus(value)) {
      setCloseTarget({ jobId: row.id, status: value });
      return;
    }
    void saveStatus(row.id, value, "");
  }

  async function saveStatus(jobId: string, status: JobStatusValue, closeReason: string) {
    setPendingId(jobId);
    try {
      const result = await updateJobStatus({ jobId, status, closeReason });
      if (!result.ok) {
        const reasonError = result.error.fields?.closeReason?.[0];
        if (reasonError) return reasonError;
        toast.error(detail.updateFailed);
        setCloseTarget(null);
        return;
      }
      setCloseTarget(null);
      router.refresh();
    } catch {
      toast.error(detail.updateFailed);
      setCloseTarget(null);
    } finally {
      setPendingId(null);
    }
    return;
  }

  async function onArchive(archived: boolean) {
    if (selectedIds.length === 0 || busy) return;
    if (selectedIds.length > ARCHIVE_JOBS_MAX) {
      toast.error(copy.tooMany(ARCHIVE_JOBS_MAX));
      return;
    }
    setBulkPending(true);
    try {
      const result = await archiveJobs({ jobIds: selectedIds, archived });
      if (!result.ok) {
        toast.error(detail.updateFailed);
        return;
      }
      toast.success(
        archived
          ? copy.archivedCount(result.data.count)
          : copy.unarchivedCount(result.data.count),
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error(detail.updateFailed);
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row" aria-live="polite">
          {selectedRows.some((row) => !row.archived) ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onArchive(true)}
            >
              {copy.archiveSelected}
            </Button>
          ) : null}
          {selectedRows.some((row) => row.archived) ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onArchive(false)}
            >
              {copy.unarchiveSelected}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                aria-label={copy.selectAll}
                disabled={busy}
              />
            </TableHead>
            {columns.map((column) => {
              const active = query.sort === column.key;
              return (
                <TableHead
                  key={column.key}
                  aria-sort={
                    active ? (query.dir === "asc" ? "ascending" : "descending") : "none"
                  }
                >
                  <Link
                    href={jobListHref(query, toggledSort(query, column.key))}
                    className="inline-flex items-center gap-1 rounded-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {column.label}
                    {active ? (
                      query.dir === "asc" ? (
                        <ArrowUp className="size-3.5" aria-hidden />
                      ) : (
                        <ArrowDown className="size-3.5" aria-hidden />
                      )
                    ) : null}
                  </Link>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox
                  checked={selected.has(row.id)}
                  onCheckedChange={(checked) => toggleOne(row.id, checked === true)}
                  aria-label={copy.selectJob(row.company)}
                  disabled={busy}
                />
              </TableCell>
              <TableCell className="max-w-48 whitespace-normal">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/jobs/${row.id}`}
                    className="font-medium break-words text-ink underline-offset-4 hover:underline"
                  >
                    {row.company}
                  </Link>
                  {row.archived ? (
                    <Badge variant="outline">{detail.archived}</Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="max-w-64 whitespace-normal">
                <span className="break-words">{row.title}</span>
              </TableCell>
              <TableCell>
                <StatusSelect
                  jobId={row.id}
                  company={row.company}
                  status={row.status}
                  disabled={busy}
                  onChange={(value) => onStatusChange(row, value)}
                />
              </TableCell>
              <TableCell>
                <PriorityCell priority={row.priority} />
              </TableCell>
              <TableCell>{row.matchLabel}</TableCell>
              <TableCell>{row.appliedLabel}</TableCell>
              <TableCell>{row.activityLabel}</TableCell>
              <TableCell>
                {row.deadlineLabel ? (
                  <span>
                    {row.deadlineLabel}
                    {row.deadlineNote === "soon" ? (
                      <span className="text-destructive"> {copy.soon}</span>
                    ) : null}
                    {row.deadlineNote === "past" ? (
                      <span className="text-destructive"> {copy.past}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-slate">{copy.emptyValue}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CloseJobDialog
        open={closeTarget !== null}
        status={closeTarget?.status ?? null}
        pending={pendingId !== null}
        onOpenChange={(open) => {
          if (!open && pendingId === null) setCloseTarget(null);
        }}
        onConfirm={async (reason) => {
          if (!closeTarget) return;
          return saveStatus(closeTarget.jobId, closeTarget.status, reason);
        }}
      />
    </div>
  );
}

function StatusSelect({
  jobId,
  company,
  status,
  disabled,
  onChange,
}: {
  jobId: string;
  company: string;
  status: JobStatusValue;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = `job-status-${jobId}`;
  return (
    <div className="grid w-40 gap-1">
      <Label htmlFor={id} className="sr-only">
        {copy.statusFor(company)}
      </Label>
      <Select value={status} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {OPEN_JOB_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {detail.statuses[value]}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{detail.closedGroup}</SelectLabel>
            {CLOSED_JOB_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {detail.statuses[value]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function PriorityCell({ priority }: { priority: number | null }) {
  if (priority === null) {
    return <span className="text-slate">{copy.emptyValue}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-ink">
      <Star aria-hidden className="size-3.5 fill-marigold text-ink" />
      <span aria-hidden>{priority}</span>
      <span className="sr-only">{strings.jobs.priorityValue(priority)}</span>
    </span>
  );
}
