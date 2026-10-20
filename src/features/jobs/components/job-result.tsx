import type { ReactNode } from "react";
import {
  Award,
  Briefcase,
  Circle,
  GraduationCap,
  Wrench,
} from "lucide-react";

import { strings } from "@/copy/strings";

import type { JobPageData } from "../queries";
import { JobAnalysisControls } from "./job-analysis-controls";

const copy = strings.jobs.result;

const kindIcons = {
  skill: Wrench,
  experience: Briefcase,
  education: GraduationCap,
  certification: Award,
  other: Circle,
} as const;

type JobResultProps = {
  job: JobPageData;
  analysesLeft: number;
};

export function JobResult({ job, analysesLeft }: JobResultProps) {
  const ready = job.analysisStatus === "READY";
  const salary = formatSalary(job);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-2xl font-semibold tracking-tight break-words text-ink md:text-3xl">
          {job.title}
        </h1>
        <p className="text-sm text-slate">
          {job.location ? `${job.company} · ${job.location}` : job.company}
        </p>
      </header>

      {job.analysisStatus === "PENDING" ? (
        <JobAnalysisControls
          jobId={job.id}
          analysesLeft={analysesLeft}
          mode="pending"
        />
      ) : null}
      {job.retryable ? (
        <JobAnalysisControls
          jobId={job.id}
          analysesLeft={analysesLeft}
          mode="failed"
        />
      ) : null}

      <section aria-labelledby="job-details" className="flex flex-col gap-3">
        <h2 id="job-details" className="text-base font-medium text-ink">
          {copy.details}
        </h2>
        <dl className="grid gap-2 text-sm">
          <Detail label={copy.workMode} value={copy.workModes[job.workMode]} />
          {job.employmentType ? (
            <Detail
              label={copy.employment}
              value={copy.employmentTypes[job.employmentType]}
            />
          ) : null}
          {salary ? <Detail label={copy.salary} value={salary} /> : null}
          {job.referenceNumber ? (
            <Detail label={copy.reference} value={job.referenceNumber} />
          ) : null}
          {job.seniority ? (
            <Detail
              label={copy.seniority}
              value={copy.seniorityLabels[job.seniority]}
            />
          ) : null}
          {job.deadline ? (
            <Detail label={copy.deadline} value={formatDeadline(job.deadline)} />
          ) : null}
          {job.source ? (
            <Detail label={copy.source} value={strings.jobs.sources[job.source]} />
          ) : null}
          {job.priority ? (
            <Detail label={strings.jobs.priorityLabel} value={strings.jobs.priorityValue(job.priority)} />
          ) : null}
          {job.url ? (
            <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
              <dt className="text-slate">{copy.url}</dt>
              <dd className="min-w-0">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-pine underline-offset-4 hover:underline"
                >
                  {job.url}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {ready && job.summary ? (
        <section aria-labelledby="job-summary" className="flex flex-col gap-2">
          <h2 id="job-summary" className="text-base font-medium text-ink">
            {copy.summary}
          </h2>
          <p className="text-sm break-words text-ink">{job.summary}</p>
        </section>
      ) : null}

      {ready ? (
        <section aria-labelledby="job-requirements" className="flex flex-col gap-3">
          <h2 id="job-requirements" className="text-base font-medium text-ink">
            {copy.requirements}
          </h2>
          {job.requirements.length === 0 ? (
            <p className="text-sm text-slate">{copy.noRequirements}</p>
          ) : (
            <ul className="grid gap-3">
              {job.requirements.map((requirement) => {
                const Icon = kindIcons[requirement.kind];
                return (
                  <li key={requirement.id} className="flex flex-col gap-1">
                    <p className="text-sm break-words text-ink">{requirement.text}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-slate">
                      <span>{requirement.importance === "must" ? copy.must : copy.nice}</span>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Icon aria-hidden className="size-3.5" />
                        {copy.kinds[requirement.kind]}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {ready ? (
        <section aria-labelledby="job-keywords" className="flex flex-col gap-3">
          <h2 id="job-keywords" className="text-base font-medium text-ink">
            {copy.keywords}
          </h2>
          {job.keywords.length === 0 ? (
            <p className="text-sm text-slate">{copy.noKeywords}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {job.keywords.map((keyword) => (
                <li
                  key={keyword}
                  className="max-w-full rounded-full bg-marigold-100 px-2.5 py-0.5 text-xs break-words text-ink"
                >
                  {keyword}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-slate">{label}</dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}

function formatDeadline(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatSalary(job: JobPageData): string | null {
  if (job.salaryMin === null && job.salaryMax === null) return null;
  const amount =
    job.salaryMin !== null &&
    job.salaryMax !== null &&
    job.salaryMin !== job.salaryMax
      ? `${formatAmount(job.salaryMin)}–${formatAmount(job.salaryMax)}`
      : formatAmount(job.salaryMin ?? job.salaryMax ?? 0);
  const period =
    job.salaryPeriod === "HOUR"
      ? copy.salaryPerHour
      : job.salaryPeriod === "YEAR"
        ? copy.salaryPerYear
        : null;
  return [job.salaryCurrency, amount, period].filter(Boolean).join(" ");
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-CA").format(value);
}
