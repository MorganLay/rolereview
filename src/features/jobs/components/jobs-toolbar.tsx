"use client";

import { useId, useRef, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  jobListHref,
  type JobListPatch,
  type JobListQuery,
} from "../list-params";
import { JOB_SOURCES, WORK_MODES, type BoardStage } from "../schemas";
import { NewJobLink } from "./new-job-link";

const copy = strings.jobs.board;
const detail = strings.jobs.detail;
const ANY = "ANY";

export function JobsToolbar({ query }: { query: JobListQuery }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const searchId = useId();
  const sourceId = useId();
  const workModeId = useId();
  const priorityId = useId();
  const deadlineId = useId();
  const archivedId = useId();

  function typedQuery(): string {
    return searchRef.current?.value.trim() ?? query.q;
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
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label={copy.viewLabel}
          className="inline-flex w-fit rounded-lg border border-border p-0.5"
        >
          <Button
            variant={query.view === "board" ? "default" : "ghost"}
            size="sm"
            asChild
          >
            <Link
              href={jobListHref(query, { view: "board" })}
              aria-current={query.view === "board" ? "page" : undefined}
            >
              {copy.viewBoard}
            </Link>
          </Button>
          <Button
            variant={query.view === "list" ? "default" : "ghost"}
            size="sm"
            asChild
          >
            <Link
              href={jobListHref(query, { view: "list" })}
              aria-current={query.view === "list" ? "page" : undefined}
            >
              {copy.viewList}
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {query.stage ? (
            <p className="text-sm text-ink">
              {copy.showingStage(stageLabel(query.stage))}{" "}
              <Link
                href={jobListHref(query, { stage: null })}
                className="underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {copy.allStages}
              </Link>
            </p>
          ) : null}
          <Button asChild className="w-full sm:w-auto">
            <NewJobLink>{strings.actions.newJob}</NewJobLink>
          </Button>
        </div>
      </div>

      <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grid w-full gap-2">
          <Label htmlFor={searchId}>{copy.searchLabel}</Label>
          <Input
            key={query.q}
            ref={searchRef}
            id={searchId}
            defaultValue={query.q}
            placeholder={copy.searchPlaceholder}
            maxLength={JOB_LIST_SEARCH_MAX}
          />
        </div>
        <Button type="submit" variant="outline" className="w-full sm:w-auto">
          {copy.search}
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
      </div>
    </div>
  );
}

function stageLabel(stage: BoardStage): string {
  return stage === "CLOSED" ? detail.closedGroup : detail.statuses[stage];
}
