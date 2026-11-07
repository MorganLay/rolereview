"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { strings } from "@/copy/strings";

import {
  JOB_LIST_SEARCH_MAX,
  activeJobFilterCount,
  jobListHref,
  type JobListPatch,
  type JobListQuery,
} from "../list-params";
import { JOB_SOURCES, WORK_MODES, type BoardStage } from "../schemas";
import { NewJobLink } from "./new-job-link";

const copy = strings.jobs.board;
const detail = strings.jobs.detail;
const ANY = "ANY";
const SEARCH_DELAY_MS = 300;

type FilterChip = {
  id: string;
  label: string;
  patch: JobListPatch;
};

export function JobsToolbar({ query }: { query: JobListQuery }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const searchId = useId();
  const [draft, setDraft] = useState(query.q);
  const filterCount = activeJobFilterCount(query);
  const sourceId = useId();
  const workModeId = useId();
  const priorityId = useId();
  const deadlineId = useId();
  const archivedId = useId();
  const chips = filterChips(query);

  useEffect(() => {
    const field = searchRef.current;
    if (field && document.activeElement === field) return;
    setDraft(query.q);
  }, [query.q]);

  useEffect(() => {
    const q = draft.trim().slice(0, JOB_LIST_SEARCH_MAX);
    if (q === query.q) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(jobListHref({ ...query, q: draft.trim() }, { q }));
      });
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, query, router]);

  function typedQuery(): string {
    return (searchRef.current?.value ?? draft).trim().slice(0, JOB_LIST_SEARCH_MAX);
  }

  function go(patch: JobListPatch) {
    const current = { ...query, q: typedQuery() };
    startTransition(() => {
      router.push(jobListHref(current, patch));
    });
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    go({ q: typedQuery() });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label={copy.viewLabel}
          className="inline-flex w-fit rounded-lg border border-border p-0.5"
        >
          <Button variant={query.view === "board" ? "default" : "ghost"} size="sm" asChild>
            <Link
              href={jobListHref(query, { view: "board" })}
              aria-current={query.view === "board" ? "page" : undefined}
            >
              {copy.viewBoard}
            </Link>
          </Button>
          <Button variant={query.view === "list" ? "default" : "ghost"} size="sm" asChild>
            <Link
              href={jobListHref(query, { view: "list" })}
              aria-current={query.view === "list" ? "page" : undefined}
            >
              {copy.viewList}
            </Link>
          </Button>
        </div>
        <Button asChild size="sm">
          <NewJobLink>{strings.actions.newJob}</NewJobLink>
        </Button>
      </div>

      <form onSubmit={onSearch} className="flex items-center gap-2">
        <div className="grid min-w-0 flex-1 gap-1">
          <Label htmlFor={searchId} className="sr-only">
            {copy.searchLabel}
          </Label>
          <Input
            ref={searchRef}
            id={searchId}
            value={draft}
            placeholder={copy.searchPlaceholder}
            maxLength={JOB_LIST_SEARCH_MAX}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              aria-label={filterCount > 0 ? copy.filtersApplied(filterCount) : undefined}
            >
              {filterCount > 0 ? copy.filtersWithCount(filterCount) : copy.filters}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] gap-3 p-3">
            <div className="grid gap-2">
              <Label htmlFor={sourceId}>{copy.sourceLabel}</Label>
              <Select
                value={query.source ?? ANY}
                onValueChange={(value) =>
                  go({ source: value === ANY ? null : (value as JobListQuery["source"]) })
                }
              >
                <SelectTrigger id={sourceId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{copy.sourceAny}</SelectItem>
                  {JOB_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {strings.jobs.sources[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={workModeId}>{copy.workModeLabel}</Label>
              <Select
                value={query.workMode ?? ANY}
                onValueChange={(value) =>
                  go({
                    workMode: value === ANY ? null : (value as JobListQuery["workMode"]),
                  })
                }
              >
                <SelectTrigger id={workModeId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{copy.workModeAny}</SelectItem>
                  {WORK_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {strings.jobs.result.workModes[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={priorityId}>{copy.priorityFilter}</Label>
              <Select
                value={query.minPriority === null ? ANY : String(query.minPriority)}
                onValueChange={(value) =>
                  go({ minPriority: value === ANY ? null : Number(value) })
                }
              >
                <SelectTrigger id={priorityId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{copy.priorityAny}</SelectItem>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {copy.priorityAtLeast(n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id={deadlineId}
                checked={query.hasDeadline}
                onCheckedChange={(checked) => go({ hasDeadline: checked === true })}
              />
              <Label htmlFor={deadlineId}>{copy.deadlineOnly}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={archivedId}
                checked={query.showArchived}
                onCheckedChange={(checked) => go({ showArchived: checked === true })}
              />
              <Label htmlFor={archivedId}>{copy.showArchived}</Label>
            </div>
          </PopoverContent>
        </Popover>
      </form>

      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.id}>
              <button
                type="button"
                className="inline-flex h-6 items-center gap-1 rounded-full border border-line bg-surface px-2 text-xs text-ink hover:bg-paper focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={copy.removeFilter(chip.label)}
                onClick={() => go(chip.patch)}
              >
                <span aria-hidden>{chip.label}</span>
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function filterChips(query: JobListQuery): FilterChip[] {
  const chips: FilterChip[] = [];
  if (query.stage) {
    chips.push({
      id: "stage",
      label: stageLabel(query.stage),
      patch: { stage: null },
    });
  }
  if (query.source) {
    chips.push({
      id: "source",
      label: strings.jobs.sources[query.source],
      patch: { source: null },
    });
  }
  if (query.workMode) {
    chips.push({
      id: "workMode",
      label: strings.jobs.result.workModes[query.workMode],
      patch: { workMode: null },
    });
  }
  if (query.minPriority !== null) {
    chips.push({
      id: "priority",
      label: copy.priorityAtLeast(query.minPriority),
      patch: { minPriority: null },
    });
  }
  if (query.hasDeadline) {
    chips.push({
      id: "deadline",
      label: copy.deadlineOnly,
      patch: { hasDeadline: false },
    });
  }
  if (query.showArchived) {
    chips.push({
      id: "archived",
      label: copy.showArchived,
      patch: { showArchived: false },
    });
  }
  return chips;
}

function stageLabel(stage: BoardStage): string {
  return stage === "CLOSED" ? detail.closedGroup : detail.statuses[stage];
}
