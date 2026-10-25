import {
  JOB_SOURCES,
  JOB_STATUSES,
  WORK_MODES,
  isBoardStage,
  isClosedJobStatus,
  type BoardStage,
  type JobStatusValue,
} from "./schemas";

/** Search text is capped at the company/title length. */
export const JOB_LIST_SEARCH_MAX = 120;

export const JOB_LIST_SORTS = [
  "company",
  "title",
  "status",
  "priority",
  "match",
  "applied",
  "activity",
  "deadline",
] as const;

export type JobListSort = (typeof JOB_LIST_SORTS)[number];
export type SortDir = "asc" | "desc";
export type JobListView = "list" | "board";

export type JobListQuery = {
  view: JobListView;
  q: string;
  source: (typeof JOB_SOURCES)[number] | null;
  workMode: (typeof WORK_MODES)[number] | null;
  minPriority: number | null;
  hasDeadline: boolean;
  showArchived: boolean;
  stage: BoardStage | null;
  sort: JobListSort;
  dir: SortDir;
};

export type JobListPatch = Partial<JobListQuery>;

export type SearchParamInput = Record<string, string | string[] | undefined>;

/** One row the list can sort without reading the database again. */
export type JobListRecord = {
  id: string;
  company: string;
  title: string;
  status: JobStatusValue;
  priority: number | null;
  matchScore: number | null;
  appliedAt: string | null;
  updatedAt: string;
  deadline: string | null;
  archived: boolean;
};

const sorts: ReadonlySet<string> = new Set(JOB_LIST_SORTS);
const sources: ReadonlySet<string> = new Set(JOB_SOURCES);
const workModes: ReadonlySet<string> = new Set(WORK_MODES);
const statusRank = new Map(JOB_STATUSES.map((status, index) => [status, index]));

export function defaultDir(sort: JobListSort): SortDir {
  if (sort === "company" || sort === "title" || sort === "status" || sort === "deadline") {
    return "asc";
  }
  return "desc";
}

export function parseJobListQuery(params: SearchParamInput): JobListQuery {
  const sortRaw = firstParam(params.sort);
  const sortValid = sorts.has(sortRaw);
  const sort = sortValid ? (sortRaw as JobListSort) : "activity";
  const dirRaw = firstParam(params.dir);
  const dir: SortDir = !sortValid
    ? "desc"
    : dirRaw === "asc" || dirRaw === "desc"
      ? dirRaw
      : defaultDir(sort);

  const priorityRaw = firstParam(params.priority);
  const minPriority = /^[1-5]$/.test(priorityRaw) ? Number(priorityRaw) : null;
  const sourceRaw = firstParam(params.source);
  const workModeRaw = firstParam(params.workMode);

  return {
    view: firstParam(params.view) === "list" ? "list" : "board",
    q: firstParam(params.q).trim().slice(0, JOB_LIST_SEARCH_MAX),
    source: sources.has(sourceRaw) ? (sourceRaw as JobListQuery["source"]) : null,
    workMode: workModes.has(workModeRaw)
      ? (workModeRaw as JobListQuery["workMode"])
      : null,
    minPriority,
    hasDeadline: firstParam(params.deadline) === "1",
    showArchived: firstParam(params.archived) === "1",
    stage: boardStageParam(firstParam(params.stage)),
    sort,
    dir,
  };
}

export function toggledSort(
  current: Pick<JobListQuery, "sort" | "dir">,
  sort: JobListSort,
): { sort: JobListSort; dir: SortDir } {
  if (current.sort === sort) {
    return { sort, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { sort, dir: defaultDir(sort) };
}

/** Filters behind the phone Filters button. Search and the stage stay outside it. */
export function activeJobFilterCount(query: JobListQuery): number {
  return [
    query.source !== null,
    query.workMode !== null,
    query.minPriority !== null,
    query.hasDeadline,
    query.showArchived,
  ].filter(Boolean).length;
}

/** Path plus query. The board and its default sort stay off the URL. */
export function jobListHref(current: JobListQuery, patch: JobListPatch = {}): string {
  const next: JobListQuery = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.view === "list") params.set("view", "list");
  if (next.q.length > 0) params.set("q", next.q);
  if (next.source) params.set("source", next.source);
  if (next.workMode) params.set("workMode", next.workMode);
  if (next.minPriority !== null) params.set("priority", String(next.minPriority));
  if (next.hasDeadline) params.set("deadline", "1");
  if (next.showArchived) params.set("archived", "1");
  if (next.stage) params.set("stage", next.stage);
  if (next.sort !== "activity" || next.dir !== "desc") {
    params.set("sort", next.sort);
    params.set("dir", next.dir);
  }
  const query = params.toString();
  return query.length > 0 ? `/jobs?${query}` : "/jobs";
}

/** A board stage filter. Closed matches every closed status. No stage matches every job. */
export function jobMatchesStage(status: JobStatusValue, stage: BoardStage | null): boolean {
  if (!stage) return true;
  if (stage === "CLOSED") return isClosedJobStatus(status);
  return status === stage;
}

export function compareJobListRows(
  a: JobListRecord,
  b: JobListRecord,
  sort: JobListSort,
  dir: SortDir,
): number {
  const primary = compareBy(a, b, sort, dir);
  if (primary !== 0) return primary;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortJobList(
  rows: readonly JobListRecord[],
  sort: JobListSort,
  dir: SortDir,
): JobListRecord[] {
  return [...rows].sort((a, b) => compareJobListRows(a, b, sort, dir));
}

function compareBy(
  a: JobListRecord,
  b: JobListRecord,
  sort: JobListSort,
  dir: SortDir,
): number {
  switch (sort) {
    case "company":
      return compareText(a.company, b.company, dir);
    case "title":
      return compareText(a.title, b.title, dir);
    case "status":
      return compareNumber(
        statusRank.get(a.status) ?? JOB_STATUSES.length,
        statusRank.get(b.status) ?? JOB_STATUSES.length,
        dir,
      );
    case "priority":
      return compareOptionalNumber(a.priority, b.priority, dir);
    case "match":
      return compareOptionalNumber(a.matchScore, b.matchScore, dir);
    case "applied":
      return compareOptionalText(a.appliedAt, b.appliedAt, dir);
    case "activity":
      return compareText(a.updatedAt, b.updatedAt, dir);
    case "deadline":
      return compareOptionalText(a.deadline, b.deadline, dir);
  }
}

function compareText(a: string, b: string, dir: SortDir): number {
  const order = a.localeCompare(b, "en", { sensitivity: "base", numeric: true });
  return dir === "asc" ? order : -order;
}

function compareNumber(a: number, b: number, dir: SortDir): number {
  const order = a - b;
  return dir === "asc" ? order : -order;
}

/** Missing values stay at the bottom in either direction. */
function compareOptionalNumber(
  a: number | null,
  b: number | null,
  dir: SortDir,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compareNumber(a, b, dir);
}

function compareOptionalText(
  a: string | null,
  b: string | null,
  dir: SortDir,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compareText(a, b, dir);
}

function boardStageParam(value: string): BoardStage | null {
  return isBoardStage(value) ? value : null;
}

function firstParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}
