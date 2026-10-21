import {
  Award,
  Briefcase,
  Circle,
  GraduationCap,
  Wrench,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { strings } from "@/copy/strings";
import { DocumentsTab, TailorPoll } from "@/features/tailor/components/documents-tab";
import type { JobDocuments } from "@/features/tailor/status";

import { formatSalaryLabel } from "../format";
import type { JobPageData } from "../queries";
import type { Requirement } from "../schemas";
import { JobAnalysisControls } from "./job-analysis-controls";
import { JobDetailsForm } from "./job-details-form";
import { JobHeader } from "./job-header";

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
  initialTab: "overview" | "documents";
};

export function JobResult({ job, analysesLeft, documents, initialTab }: JobResultProps) {
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

      <Tabs defaultValue={initialTab}>
        <TabsList aria-label={documentsCopy.tabsLabel}>
          <TabsTrigger value="overview">{documentsCopy.overviewTab}</TabsTrigger>
          <TabsTrigger value="documents">{documentsCopy.documentsTab}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex flex-col gap-8 pt-4">
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
      </Tabs>
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
      <ul className="grid gap-3">
        {items.map((requirement) => {
          const Icon = kindIcons[requirement.kind];
          return (
            <li key={requirement.id} className="flex flex-col gap-1">
              <p className="text-sm break-words text-ink">{requirement.text}</p>
              <p className="inline-flex items-center gap-1 text-xs text-slate">
                <Icon aria-hidden className="size-3.5" />
                {copy.kinds[requirement.kind]}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
