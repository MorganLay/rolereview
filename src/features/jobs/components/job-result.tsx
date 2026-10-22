import Link from "next/link";
import {
  Award,
  Briefcase,
  Circle,
  GraduationCap,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { strings } from "@/copy/strings";
import { DocumentsTab, TailorPoll } from "@/features/tailor/components/documents-tab";
import type { JobDocuments } from "@/features/tailor/status";
import { ContactsTab } from "@/features/tracking/components/contacts-tab";
import { InterviewsTab } from "@/features/tracking/components/interviews-tab";
import { RemindersTab } from "@/features/tracking/components/reminders-tab";
import { TimelineTab } from "@/features/tracking/components/timeline-tab";
import type { ContactPick, JobContactView } from "@/features/tracking/contacts";
import type { TimelineEventView } from "@/features/tracking/events";
import type { InterviewView } from "@/features/tracking/interviews";
import type { ReminderView } from "@/features/tracking/reminders";

import { formatSalaryLabel } from "../format";
import type { JobPageData } from "../queries";
import type { Requirement } from "../schemas";
import { JobAnalysisControls } from "./job-analysis-controls";
import { JobDetailsForm } from "./job-details-form";
import { JobHeader } from "./job-header";
import { JobSections, type JobSectionTab } from "./job-sections";

const copy = strings.jobs.result;
const detail = strings.jobs.detail;
const documentsCopy = strings.jobs.documents;

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
  documents: JobDocuments;
  initialTab: JobSectionTab;
  timeline: TimelineEventView[];
  hideAuto: boolean;
  today: string;
  interviews: InterviewView[];
  interviewTimeZone: string;
  interviewNow: string;
  nextRound: number;
  linkedContacts: JobContactView[];
  contactDirectory: ContactPick[];
  openReminders: ReminderView[];
  completedReminders: ReminderView[];
  reminderToday: string;
};

export function JobResult({
  job,
  analysesLeft,
  documents,
  initialTab,
  timeline,
  hideAuto,
  today,
  interviews,
  interviewTimeZone,
  interviewNow,
  nextRound,
  linkedContacts,
  contactDirectory,
  openReminders,
  completedReminders,
  reminderToday,
}: JobResultProps) {
  const ready = job.analysisStatus === "READY";
  const must = job.requirements.filter((item) => item.importance === "must");
  const nice = job.requirements.filter((item) => item.importance === "nice");

  return (
    <div className="flex flex-col gap-8">
      <JobHeader
        jobId={job.id}
        title={job.title}
        company={job.company}
        location={job.location}
        url={job.url}
        status={job.status}
        priority={job.priority}
        archived={job.archived}
        deadline={job.deadline}
        workMode={job.workMode}
        employmentType={job.employmentType}
        salaryLabel={formatSalaryLabel(job)}
        referenceNumber={job.referenceNumber}
      />

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

      <section className="flex flex-col items-start gap-2 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">{documentsCopy.promptTitle}</h2>
        <p className="text-sm text-slate">{documentsCopy.promptBody}</p>
        <Button asChild>
          <Link href={`/jobs/${job.id}?tab=documents`}>{documentsCopy.promptAction}</Link>
        </Button>
      </section>

      <JobSections jobId={job.id} initialTab={initialTab} hideAuto={hideAuto}>
        <TabsContent value="overview" className="flex flex-col gap-6 pt-4">
          {ready && job.summary ? (
            <section aria-labelledby="job-summary" className="flex flex-col gap-2">
              <h2 id="job-summary" className="text-base font-medium text-ink">
                {copy.summary}
              </h2>
              <p className="text-sm break-words text-ink">{job.summary}</p>
              {job.seniority && job.seniority !== "unknown" ? (
                <p className="text-sm text-slate">
                  {copy.seniority}: {copy.seniorityLabels[job.seniority]}
                </p>
              ) : null}
            </section>
          ) : null}

          {ready ? (
            <section aria-labelledby="job-requirements" className="flex flex-col gap-4">
              <h2 id="job-requirements" className="text-base font-medium text-ink">
                {copy.requirements}
              </h2>
              {job.requirements.length === 0 ? (
                <p className="text-sm text-slate">{copy.noRequirements}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <RequirementGroup heading={copy.must} items={must} />
                  <RequirementGroup heading={copy.nice} items={nice} />
                </div>
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

          <details>
            <summary className="cursor-pointer text-base font-medium text-ink marker:text-slate">
              {detail.posting}
            </summary>
            <p className="mt-2 text-xs text-slate">{detail.postingHint}</p>
            <div className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-3 text-sm break-words whitespace-pre-wrap text-ink">
              {job.rawText}
            </div>
          </details>

          <JobDetailsForm
            jobId={job.id}
            source={job.source}
            sourceDetail={job.sourceDetail}
            workMode={job.workMode}
            employmentType={job.employmentType}
            salaryMin={job.salaryMin}
            salaryMax={job.salaryMax}
            salaryCurrency={job.salaryCurrency}
            salaryPeriod={job.salaryPeriod}
            referenceNumber={job.referenceNumber}
            deadline={job.deadline}
            notes={job.notes}
          />
        </TabsContent>
        <TabsContent value="documents" className="pt-4">
          <DocumentsTab
            jobId={job.id}
            analysisReady={ready}
            documents={documents}
          />
        </TabsContent>
        <TabsContent value="interviews" className="pt-4">
          <InterviewsTab
            jobId={job.id}
            interviews={interviews}
            timeZone={interviewTimeZone}
            now={interviewNow}
            nextRound={nextRound}
          />
        </TabsContent>
        <TabsContent value="contacts" className="pt-4">
          <ContactsTab
            jobId={job.id}
            linked={linkedContacts}
            directory={contactDirectory}
          />
        </TabsContent>
        <TabsContent value="reminders" className="pt-4">
          <RemindersTab
            jobId={job.id}
            open={openReminders}
            completed={completedReminders}
            today={reminderToday}
          />
        </TabsContent>
        <TabsContent value="timeline" className="pt-4">
          <TimelineTab
            jobId={job.id}
            events={timeline}
            hideAuto={hideAuto}
            today={today}
            contacts={linkedContacts.map((contact) => ({
              id: contact.id,
              name: contact.name,
            }))}
          />
        </TabsContent>
      </JobSections>
      {documents.pending ? <TailorPoll /> : null}
    </div>
  );
}

function RequirementGroup({
  heading,
  items,
}: {
  heading: string;
  items: Requirement[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-ink">{heading}</h3>
      <ul className="grid gap-2">
        {items.map((requirement) => {
          const Icon = kindIcons[requirement.kind];
          return (
            <li key={requirement.id} className="flex items-start gap-2">
              <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-slate" />
              <p className="text-sm break-words text-ink">
                <span className="sr-only">{copy.kinds[requirement.kind]}. </span>
                {requirement.text}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
