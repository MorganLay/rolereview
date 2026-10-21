import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { strings } from "@/copy/strings";
import { JobsBoard } from "@/features/jobs/components/jobs-board";
import { NewJobLink } from "@/features/jobs/components/new-job-link";
import { JobsTable } from "@/features/jobs/components/jobs-table";
import { JobsToolbar } from "@/features/jobs/components/jobs-toolbar";
import { calendarDateInTimeZone } from "@/features/jobs/dates";
import { presentBoardCard, presentJobListRow } from "@/features/jobs/format";
import {
  jobListHref,
  parseJobListQuery,
  sortJobList,
  type JobListQuery,
} from "@/features/jobs/list-params";
import { listBoardJobs, listJobs } from "@/features/jobs/queries";
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
  const listed =
    query.view === "list"
      ? await listJobs(user.id, query)
      : await listBoardJobs(user.id, query);
  const today = calendarDateInTimeZone(new Date(), listed.timeZone);
  const rows =
    query.view === "list" && "jobs" in listed
      ? sortJobList(listed.jobs, query.sort, query.dir).map((row) =>
          presentJobListRow(row, listed.timeZone, today),
        )
      : [];
  const cards =
    query.view === "board" && "cards" in listed
      ? listed.cards.map((card) => presentBoardCard(card, listed.timeZone, today))
      : [];
  const visibleCount = query.view === "list" ? rows.length : cards.length;

  return (
    <div
      className={
        query.view === "board"
          ? "flex w-full flex-col gap-6"
          : "mx-auto flex w-full max-w-6xl flex-col gap-6"
      }
    >
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {strings.pages.jobs.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate">{strings.pages.jobs.body}</p>
      </div>
      <JobsToolbar query={query} />
      {listed.total === 0 ? (
        <JobsEmpty />
      ) : visibleCount === 0 ? (
        <JobsFiltered query={query} />
      ) : query.view === "list" ? (
        <JobsTable key={jobListHref(query)} query={query} rows={rows} />
      ) : (
        <JobsBoard key={jobListHref(query)} cards={cards} />
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
