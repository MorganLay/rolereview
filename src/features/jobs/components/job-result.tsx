import {
  Award,
  Briefcase,
  Circle,
  GraduationCap,
  Wrench,
} from "lucide-react";

import { TabsContent } from "@/components/ui/tabs";
import { strings } from "@/copy/strings";
import { LettersSection } from "@/features/letters/components/letters-section";
import type { JobLetters } from "@/features/letters/status";
import { DocumentsTab, TailorPoll } from "@/features/tailor/components/documents-tab";
import type { JobDocuments } from "@/features/tailor/status";
import { ContactsTab } from "@/features/tracking/components/contacts-tab";
import { InterviewsTab } from "@/features/tracking/components/interviews-tab";
import { OfferTab } from "@/features/tracking/components/offer-tab";
import { RemindersTab } from "@/features/tracking/components/reminders-tab";
import { TimelineTab } from "@/features/tracking/components/timeline-tab";
import type { ContactPick, JobContactView } from "@/features/tracking/contacts";
import type { TimelineEventView } from "@/features/tracking/events";
import type { InterviewView } from "@/features/tracking/interviews";
import type { OfferView } from "@/features/tracking/offers";
import type { ReminderView } from "@/features/tracking/reminders";

import type { JobPageData } from "../queries";
import type { Requirement } from "../schemas";
import { JobAnalysisControls } from "./job-analysis-controls";
import { JobDetailsForm } from "./job-details-form";
import { JobHeader, JobPriority } from "./job-header";
import { JobSections, type JobSectionTab } from "./job-sections";

const copy = strings.jobs.result;
const detail = strings.jobs.detail;

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
  letters: JobLetters;
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
  offer: OfferView | null;
  showOffer: boolean;
};

export function JobResult({
  job,
  analysesLeft,
  documents,
  letters,
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
  offer,
  showOffer,
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
        archived={job.archived}
        offerTabVisible={showOffer}
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

      <JobSections
        jobId={job.id}
        initialTab={initialTab}
        hideAuto={hideAuto}
        showOffer={showOffer}
      >
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

          <JobPriority jobId={job.id} priority={job.priority} />
          {job.url ? (
            <p className="text-sm break-words">
              <span className="text-ink">{strings.jobs.urlLabel}</span>
              {" · "}
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-pine underline-offset-4 hover:underline"
              >
                {job.url}
                <span className="sr-only"> ({detail.newTab})</span>
              </a>
            </p>
          ) : null}

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
        <TabsContent value="documents" className="flex flex-col gap-8 pt-4">
          <DocumentsTab
            jobId={job.id}
            analysisReady={ready}
            documents={documents}
          />
          <LettersSection
            jobId={job.id}
            analysisReady={ready}
            libraryReady={documents.canTailor}
            letters={letters}
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
        {showOffer ? (
          <TabsContent value="offer" className="pt-4">
            <OfferTab jobId={job.id} offer={offer} />
          </TabsContent>
        ) : null}
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
      {documents.pending || letters.pending ? <TailorPoll /> : null}
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
