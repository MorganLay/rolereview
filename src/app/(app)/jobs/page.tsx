import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { strings } from "@/copy/strings";
import { NewJobLink } from "@/features/jobs/components/new-job-link";
import { JobsTable } from "@/features/jobs/components/jobs-table";
import { JobsToolbar } from "@/features/jobs/components/jobs-toolbar";
import { calendarDateInTimeZone } from "@/features/jobs/dates";
import { presentJobListRow } from "@/features/jobs/format";
import {
  jobListHref,
  parseJobListQuery,
  sortJobList,
  type JobListQuery,
} from "@/features/jobs/list-params";
import { listJobs } from "@/features/jobs/queries";
import { requireUser } from "@/lib/auth";

/** The list comes from the signed-in user. */
export const instant = false;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const query = parseJobListQuery(await searchParams);
  const listed = await listJobs(user.id, query);
  const today = calendarDateInTimeZone(new Date(), listed.timeZone);
  const rows = sortJobList(listed.jobs, query.sort, query.dir).map((row) =>
    presentJobListRow(row, listed.timeZone, today),
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {strings.pages.jobs.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate">{strings.pages.jobs.body}</p>
      </div>
      <JobsToolbar query={query} />
      {listed.total === 0 ? (
        <JobsEmpty />
      ) : query.view === "board" ? (
        <BoardLater query={query} />
      ) : rows.length === 0 ? (
        <JobsFiltered query={query} />
      ) : (
        <JobsTable key={jobListHref(query)} query={query} rows={rows} />
      )}
    </div>
  );
}

function JobsEmpty() {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-slate">{strings.jobs.board.emptyBody}</p>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <NewJobLink>{strings.actions.newJob}</NewJobLink>
        </Button>
      </CardContent>
    </Card>
  );
}

function BoardLater({ query }: { query: JobListQuery }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-medium text-ink">
          {strings.jobs.board.boardLaterTitle}
        </h2>
        <p className="text-sm text-slate">{strings.jobs.board.boardLaterBody}</p>
      </CardHeader>
      <CardContent>
        <Button variant="outline" asChild>
          <Link href={jobListHref(query, { view: "list" })}>
            {strings.jobs.board.viewList}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function JobsFiltered({ query }: { query: JobListQuery }) {
  const cleared = jobListHref(query, {
    q: "",
    source: null,
    workMode: null,
    minPriority: null,
    hasDeadline: false,
    showArchived: false,
    sort: "activity",
    dir: "desc",
  });

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-slate">{strings.jobs.board.filteredBody}</p>
      </CardHeader>
      <CardContent>
        <Button variant="outline" asChild>
          <Link href={cleared}>{strings.jobs.board.clearFilters}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
