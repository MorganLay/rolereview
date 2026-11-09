/**
 * Returning-user dashboard: summary counts and one action list.
 * docs/02-USER-FLOWS.md → /dashboard.
 *
 * Archived jobs and closed jobs stay out of the list, the urgent count,
 * and Continue working. A closed status is Accepted, Rejected, Withdrawn,
 * or No response.
 *
 * Dated items sort by their instant, earliest first, so an overdue date
 * comes before an upcoming one and a sooner date comes before a later one.
 * The same instant uses deadline, then offer respond-by, then interview,
 * then follow-up, then document. Undated items come after every dated item.
 *
 * A deadline row is an open deadline reminder. Its date is the job deadline
 * when that date is set, otherwise the reminder's due day. An offer row is
 * the respond-by date; the offer-response reminder is not a second row.
 * An interview row is one that starts now or later. A past interview is left
 * out. A follow-up is an open follow-up, thank-you, custom, or interview
 * reminder. Applied and Screening also get the next step when that job has
 * no open follow-up, thank-you, or custom reminder. A document is the newest
 * ready resume that is unfinished: on a Saved job it is not exported, and on
 * any other open job it has not been submitted.
 *
 * The dashboard attention list drops documents, and it drops the undated
 * "follow up" row on Applied or Screening unless 30 days have passed with
 * no response. Continue where you left off is a different choice: a resume
 * still being written, then unfinished work on a Saved job. A job that is
 * already Applied is not asked to review its resume.
 */

import { RECENT_JOB_LIMIT } from "@/features/dashboard/metrics";
import {
  calendarDateInTimeZone,
  daysUntilDeadline,
  deadlineInstant,
  isCalendarDate,
} from "@/features/jobs/dates";
import {
  newestReadyResume,
  nextAction,
  type NextAction,
} from "@/features/jobs/next-action";
import { isClosedJobStatus, type JobStatusValue } from "@/features/jobs/schemas";
import { compareTimelineEvents } from "@/features/tracking/events";
import { isUpcomingInterview } from "@/features/tracking/reminders";

export const NO_RESPONSE_DAYS = 30;
export const ACTIVITY_LIMIT = 5;

export const ACTION_KINDS = [
  "deadline",
  "offer",
  "interview",
  "followUp",
  "document",
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

const KIND_RANK: Record<ActionKind, number> = {
  deadline: 0,
  offer: 1,
  interview: 2,
  followUp: 3,
  document: 4,
};

export type DateTiming = "overdue" | "today" | "upcoming";

export type ActionReason =
  | { type: "deadline"; timing: DateTiming; date: string }
  | { type: "offer"; timing: DateTiming; date: string }
  | { type: "interview"; soon: boolean; at: string }
  | { type: "followUpDue"; timing: DateTiming; date: string }
  | { type: "followUpNext"; stale: boolean }
  | { type: "document"; exported: boolean };

export type HomeReminder = {
  id: string;
  kind: string;
  title: string;
  dueAt: Date;
  /** False once the reminder is done or dismissed. */
  open: boolean;
};

export type HomeInterview = {
  id: string;
  round: number;
  kind: string;
  scheduledAt: Date;
};

/** A READY resume. Other statuses are not passed in. */
export type HomeResume = {
  id: string;
  version: number;
  exported: boolean;
  submitted: boolean;
  updatedAt: Date;
};

export type HomeJob = {
  id: string;
  company: string;
  title: string;
  status: JobStatusValue;
  archived: boolean;
  appliedAt: Date | null;
  firstResponseAt: Date | null;
  submittedResumeId: string | null;
  analysisReady: boolean;
  hasOffer: boolean;
  /** Calendar date, or null when the job has no deadline. */
  deadline: string | null;
  /** Calendar date, or null when the offer has no respond-by. */
  respondBy: string | null;
  updatedAt: Date;
  reminders: readonly HomeReminder[];
  interviews: readonly HomeInterview[];
  resumes: readonly HomeResume[];
  /** Newest PENDING resume that is still inside the tailor window. */
  tailoringUpdatedAt: Date | null;
};

export type DashboardAction = {
  id: string;
  kind: ActionKind;
  jobId: string;
  company: string;
  title: string;
  href: string;
  reason: ActionReason;
  /** Null when the item has no date. Those sort after every dated item. */
  sortAt: number | null;
  reminderTitle: string | null;
  interviewRound: number | null;
  interviewKind: string | null;
};

export type DashboardSummary = {
  active: number;
  interviews: number;
  offers: number;
  urgent: number;
};

/** What the continuation row asks the person to do. */
export type ContinueKind = "tailoring" | "review" | "tailor" | "preview" | "open";

export type ContinueWork = {
  id: string;
  kind: ContinueKind;
  jobId: string;
  company: string;
  title: string;
  href: string;
  updatedAt: Date;
  jobStatus: JobStatusValue;
};

export type RecentApplication = {
  id: string;
  company: string;
  title: string;
  status: JobStatusValue;
  href: string;
  updatedAt: Date;
  appliedAt: Date | null;
  deadline: string | null;
};

export type ActivityEvent = {
  id: string;
  jobId: string;
  company: string;
  title: string;
  type: string;
  occurredAt: Date;
  createdAt: Date;
  manual: boolean;
  archived: boolean;
};

export type ActivityItem = {
  id: string;
  jobId: string;
  company: string;
  title: string;
  type: string;
  occurredAt: Date;
  manual: boolean;
  href: string;
};

const FOLLOW_UP_REMINDERS = new Set(["FOLLOW_UP", "THANK_YOU", "CUSTOM", "INTERVIEW"]);
const FOLLOW_UP_BLOCKING_NEXT = new Set(["FOLLOW_UP", "THANK_YOU", "CUSTOM"]);

/**
 * Active, interviewing, and offer counts, plus urgent dated items.
 * Urgent is a deadline on today or earlier, a respond-by on today or earlier,
 * an interview that starts within 48 hours, or a follow-up reminder due
 * before the next local midnight. Undated rows are not urgent.
 */
export function dashboardSummary(
  jobs: readonly HomeJob[],
  actions: readonly DashboardAction[],
): DashboardSummary {
  let active = 0;
  let interviews = 0;
  let offers = 0;
  for (const job of jobs) {
    if (job.archived) continue;
    if (!isClosedJobStatus(job.status)) active += 1;
    if (job.status === "INTERVIEWING") interviews += 1;
    if (job.status === "OFFER") offers += 1;
  }
  return {
    active,
    interviews,
    offers,
    urgent: actions.filter(isUrgentAction).length,
  };
}

export function isUrgentAction(action: DashboardAction): boolean {
  const reason = action.reason;
  if (reason.type === "deadline" || reason.type === "offer" || reason.type === "followUpDue") {
    return reason.timing === "overdue" || reason.timing === "today";
  }
  if (reason.type === "interview") return reason.soon;
  return false;
}

/** One list. The most urgent dated item is first. */
export function dashboardActions(
  jobs: readonly HomeJob[],
  now: Date,
  timeZone: string,
): DashboardAction[] {
  const today = calendarDateInTimeZone(now, timeZone);
  const actions: DashboardAction[] = [];
  for (const job of jobs) {
    if (!isOpenJob(job)) continue;
    actions.push(
      ...deadlineActions(job, today, timeZone),
      ...offerActions(job, today, timeZone),
      ...interviewActions(job, now),
      ...followUpActions(job, today, timeZone),
    );
    const document = documentAction(job);
    if (document) actions.push(document);
  }
  actions.sort(compareDashboardActions);
  return actions;
}

const CONTINUE_RANK: Record<ContinueKind, number> = {
  tailoring: 0,
  review: 1,
  tailor: 2,
  preview: 3,
  open: 4,
};

/**
 * One place to resume. A resume that is still being written comes first.
 * After that, only a Saved job: review an unexported resume, tailor one,
 * preview an exported one, or open a posting whose analysis is not ready.
 * The same rank uses the latest update, then the lower id.
 * Applied and later stages are not asked to review an unsubmitted resume.
 */
export function continueWorking(jobs: readonly HomeJob[]): ContinueWork | null {
  const candidates: RankedContinue[] = [];
  for (const job of jobs) {
    const candidate = continueCandidate(job);
    if (candidate) candidates.push(candidate);
  }
  candidates.sort(compareContinue);
  const picked = candidates[0];
  if (!picked) return null;
  return {
    id: picked.id,
    kind: picked.kind,
    jobId: picked.jobId,
    company: picked.company,
    title: picked.title,
    href: picked.href,
    updatedAt: picked.updatedAt,
    jobStatus: picked.jobStatus,
  };
}

/**
 * Deadlines, offers, interviews, and real follow-ups. An unfinished resume
 * stays on Continue. An Applied or Screening job with no reminder is listed
 * only when the application is stale.
 */
export function attentionItems(actions: readonly DashboardAction[]): DashboardAction[] {
  return actions.filter((action) => {
    if (action.kind === "document") return false;
    if (action.reason.type === "followUpNext" && !action.reason.stale) return false;
    return true;
  });
}

/** One row per job, newest update first. Archived jobs are left out. */
export function recentApplications(
  jobs: readonly HomeJob[],
  limit = RECENT_JOB_LIMIT,
): RecentApplication[] {
  return [...jobs]
    .filter((job) => !job.archived)
    .sort((a, b) => {
      const byTime = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (byTime !== 0) return byTime;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, limit)
    .map((job) => ({
      id: job.id,
      company: job.company,
      title: job.title,
      status: job.status,
      href: `/jobs/${encodeURIComponent(job.id)}`,
      updatedAt: job.updatedAt,
      appliedAt: job.appliedAt,
      deadline: job.deadline,
    }));
}

/** Newest timeline events. Archived jobs are left out. The same instant uses the timeline order. */
export function recentActivity(
  events: readonly ActivityEvent[],
  limit = ACTIVITY_LIMIT,
): ActivityItem[] {
  return events
    .filter((event) => !event.archived)
    .sort(compareTimelineEvents)
    .slice(0, limit)
    .flatMap((event) => {
      const href = jobTabHref(event.jobId, "timeline");
      if (!isSpecificJobHref(href)) return [];
      return [
        {
          id: event.id,
          jobId: event.jobId,
          company: event.company,
          title: event.title,
          type: event.type,
          occurredAt: event.occurredAt,
          manual: event.manual,
          href,
        },
      ];
    });
}

export function compareDashboardActions(a: DashboardAction, b: DashboardAction): number {
  const aDated = a.sortAt !== null;
  const bDated = b.sortAt !== null;
  if (aDated !== bDated) return aDated ? -1 : 1;
  if (a.sortAt !== null && b.sortAt !== null && a.sortAt !== b.sortAt) {
    return a.sortAt - b.sortAt;
  }
  const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
  if (byKind !== 0) return byKind;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** True when the href opens a tab or a resume, and not the board, dashboard, or bare job. */
export function isSpecificJobHref(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href, "https://rolerefine.local");
  } catch {
    return false;
  }
  if (url.origin !== "https://rolerefine.local") return false;
  const parts = url.pathname.split("/").filter((part) => part.length > 0);
  if (parts[0] !== "jobs") return false;
  if (parts.length === 1) return false;
  if (parts.length === 2) {
    const tab = url.searchParams.get("tab");
    return tab !== null && tab.length > 0;
  }
  return parts[2] === "resumes" && (parts[3]?.length ?? 0) > 0;
}

export function jobTabHref(
  jobId: string,
  tab: "documents" | "interviews" | "offer" | "reminders" | "timeline",
): string {
  return `/jobs/${encodeURIComponent(jobId)}?tab=${tab}`;
}

export function resumeWorkspaceHref(jobId: string, resumeId: string): string {
  return `/jobs/${encodeURIComponent(jobId)}/resumes/${encodeURIComponent(resumeId)}`;
}

function deadlineActions(job: HomeJob, today: string, timeZone: string): DashboardAction[] {
  const href = specific(jobNext(job)?.href ?? jobTabHref(job.id, "reminders"));
  if (!href) return [];
  const rows: DashboardAction[] = [];
  for (const reminder of job.reminders) {
    if (!reminder.open || reminder.kind !== "DEADLINE") continue;
    const date =
      job.deadline && isCalendarDate(job.deadline)
        ? job.deadline
        : calendarDateInTimeZone(reminder.dueAt, timeZone);
    rows.push(
      row(job, {
        id: `deadline:${reminder.id}`,
        kind: "deadline",
        href,
        reason: { type: "deadline", timing: calendarTiming(date, today), date },
        sortAt: calendarSortAt(date) ?? reminder.dueAt.getTime(),
      }),
    );
  }
  return rows;
}

function offerActions(job: HomeJob, today: string, timeZone: string): DashboardAction[] {
  const href = specific(jobTabHref(job.id, "offer"));
  if (!href) return [];
  if (job.respondBy && isCalendarDate(job.respondBy)) {
    return [
      row(job, {
        id: `offer:${job.id}`,
        kind: "offer",
        href,
        reason: {
          type: "offer",
          timing: calendarTiming(job.respondBy, today),
          date: job.respondBy,
        },
        sortAt: deadlineInstant(job.respondBy).getTime(),
      }),
    ];
  }
  const rows: DashboardAction[] = [];
  for (const reminder of job.reminders) {
    if (!reminder.open || reminder.kind !== "OFFER_RESPONSE") continue;
    const date = calendarDateInTimeZone(reminder.dueAt, timeZone);
    rows.push(
      row(job, {
        id: `offer:${reminder.id}`,
        kind: "offer",
        href,
        reason: { type: "offer", timing: calendarTiming(date, today), date },
        sortAt: reminder.dueAt.getTime(),
      }),
    );
  }
  return rows;
}

function interviewActions(job: HomeJob, now: Date): DashboardAction[] {
  const href = specific(jobTabHref(job.id, "interviews"));
  if (!href) return [];
  const rows: DashboardAction[] = [];
  for (const interview of job.interviews) {
    if (interview.scheduledAt.getTime() < now.getTime()) continue;
    rows.push(
      row(job, {
        id: `interview:${interview.id}`,
        kind: "interview",
        href,
        reason: {
          type: "interview",
          soon: isUpcomingInterview(interview.scheduledAt, now),
          at: interview.scheduledAt.toISOString(),
        },
        sortAt: interview.scheduledAt.getTime(),
        interviewRound: interview.round,
        interviewKind: interview.kind,
      }),
    );
  }
  return rows;
}

function followUpActions(job: HomeJob, today: string, timeZone: string): DashboardAction[] {
  const rows: DashboardAction[] = [];
  let blocksNextStep = false;
  for (const reminder of job.reminders) {
    if (!reminder.open || !FOLLOW_UP_REMINDERS.has(reminder.kind)) continue;
    if (FOLLOW_UP_BLOCKING_NEXT.has(reminder.kind)) blocksNextStep = true;
    const href = specific(
      reminder.kind === "INTERVIEW"
        ? jobTabHref(job.id, "interviews")
        : jobTabHref(job.id, "timeline"),
    );
    if (!href) continue;
    const date = calendarDateInTimeZone(reminder.dueAt, timeZone);
    rows.push(
      row(job, {
        id: `followUp:${reminder.id}`,
        kind: "followUp",
        href,
        reason: { type: "followUpDue", timing: dueTiming(reminder.dueAt, today, timeZone), date },
        sortAt: reminder.dueAt.getTime(),
        reminderTitle: reminder.title,
      }),
    );
  }
  if (
    (job.status === "APPLIED" || job.status === "SCREENING") &&
    !blocksNextStep
  ) {
    const href = specific(jobNext(job)?.href ?? jobTabHref(job.id, "timeline"));
    if (href) {
      rows.push(
        row(job, {
          id: `followUpNext:${job.id}`,
          kind: "followUp",
          href,
          reason: { type: "followUpNext", stale: isStaleApplication(job, today, timeZone) },
          sortAt: null,
        }),
      );
    }
  }
  return rows;
}

function documentAction(job: HomeJob): DashboardAction | null {
  const latest = newestReadyResume(
    job.resumes
      .filter((resume) => resume.id.length > 0)
      .map((resume) => ({
        id: resume.id,
        version: resume.version,
        exported: resume.exported,
      })),
  );
  if (!latest) return null;
  const resume = job.resumes.find((item) => item.id === latest.id);
  if (!resume) return null;
  if (resume.submitted) return null;
  const href = specific(resumeWorkspaceHref(job.id, latest.id));
  if (!href) return null;
  return row(job, {
    id: `document:${job.id}:${latest.id}`,
    kind: "document",
    href,
    reason: { type: "document", exported: latest.exported },
    sortAt: null,
  });
}

function isStaleApplication(job: HomeJob, today: string, timeZone: string): boolean {
  if (job.status !== "APPLIED" || !job.appliedAt) return false;
  const applied = calendarDateInTimeZone(job.appliedAt, timeZone);
  const age = daysUntilDeadline(today, applied);
  return age !== null && age >= NO_RESPONSE_DAYS;
}

function jobNext(job: HomeJob): NextAction | null {
  return nextAction({
    jobId: job.id,
    status: job.status,
    analysisReady: job.analysisReady,
    latestReadyResume: newestReadyResume(
      job.resumes
        .filter((resume) => resume.id.length > 0)
        .map((resume) => ({
          id: resume.id,
          version: resume.version,
          exported: resume.exported,
        })),
    ),
    hasOffer: job.hasOffer,
  });
}

function isOpenJob(job: HomeJob): boolean {
  return !job.archived && !isClosedJobStatus(job.status);
}

function calendarTiming(date: string, today: string): DateTiming {
  if (date < today) return "overdue";
  if (date > today) return "upcoming";
  return "today";
}

function dueTiming(dueAt: Date, today: string, timeZone: string): DateTiming {
  return calendarTiming(calendarDateInTimeZone(dueAt, timeZone), today);
}

function calendarSortAt(date: string): number | null {
  if (!isCalendarDate(date)) return null;
  return deadlineInstant(date).getTime();
}

function specific(href: string): string | null {
  return isSpecificJobHref(href) ? href : null;
}

function row(
  job: HomeJob,
  partial: {
    id: string;
    kind: ActionKind;
    href: string;
    reason: ActionReason;
    sortAt: number | null;
    reminderTitle?: string | null;
    interviewRound?: number | null;
    interviewKind?: string | null;
  },
): DashboardAction {
  return {
    jobId: job.id,
    company: job.company,
    title: job.title,
    reminderTitle: partial.reminderTitle ?? null,
    interviewRound: partial.interviewRound ?? null,
    interviewKind: partial.interviewKind ?? null,
    id: partial.id,
    kind: partial.kind,
    href: partial.href,
    reason: partial.reason,
    sortAt: partial.sortAt,
  };
}

type RankedContinue = ContinueWork & { rank: number };

function continueCandidate(job: HomeJob): RankedContinue | null {
  if (!isOpenJob(job)) return null;
  if (job.tailoringUpdatedAt) {
    const href = specific(jobTabHref(job.id, "documents"));
    if (!href) return null;
    return ranked(job, {
      id: `tailoring:${job.id}`,
      kind: "tailoring",
      href,
      updatedAt: job.tailoringUpdatedAt,
    });
  }
  if (job.status !== "SAVED") return null;

  const next = jobNext(job);
  if (next?.kind === "review" || next?.kind === "tailor" || next?.kind === "preview") {
    const href = specific(next.href);
    if (!href) return null;
    return ranked(job, {
      id: `${next.kind}:${job.id}`,
      kind: next.kind,
      href,
      updatedAt: next.kind === "review" ? reviewUpdatedAt(job) : job.updatedAt,
    });
  }

  return ranked(job, {
    id: `open:${job.id}`,
    kind: "open",
    href: `/jobs/${encodeURIComponent(job.id)}`,
    updatedAt: job.updatedAt,
  });
}

function reviewUpdatedAt(job: HomeJob): Date {
  const latest = newestReadyResume(
    job.resumes
      .filter((resume) => resume.id.length > 0)
      .map((resume) => ({
        id: resume.id,
        version: resume.version,
        exported: resume.exported,
      })),
  );
  const resume = latest ? job.resumes.find((item) => item.id === latest.id) : undefined;
  return resume?.updatedAt ?? job.updatedAt;
}

function ranked(
  job: HomeJob,
  partial: { id: string; kind: ContinueKind; href: string; updatedAt: Date },
): RankedContinue {
  return {
    id: partial.id,
    kind: partial.kind,
    jobId: job.id,
    company: job.company,
    title: job.title,
    href: partial.href,
    updatedAt: partial.updatedAt,
    jobStatus: job.status,
    rank: CONTINUE_RANK[partial.kind],
  };
}

function compareContinue(a: RankedContinue, b: RankedContinue): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const byTime = b.updatedAt.getTime() - a.updatedAt.getTime();
  if (byTime !== 0) return byTime;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
