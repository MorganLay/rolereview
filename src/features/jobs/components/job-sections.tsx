"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { strings } from "@/copy/strings";

const documentsCopy = strings.jobs.documents;
const interviewsCopy = strings.jobs.interviews;
const contactsCopy = strings.nav.contacts;
const timelineCopy = strings.jobs.timeline;
const remindersCopy = strings.jobs.reminders;
const offerCopy = strings.jobs.offer;

export type JobSectionTab =
  | "overview"
  | "documents"
  | "interviews"
  | "contacts"
  | "timeline"
  | "reminders"
  | "offer";

export function JobSections({
  jobId,
  initialTab,
  hideAuto,
  showOffer,
  documentCount,
  children,
}: {
  jobId: string;
  initialTab: JobSectionTab;
  hideAuto: boolean;
  showOffer: boolean;
  documentCount: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onValueChange(value: string) {
    if (
      value !== "overview" &&
      value !== "documents" &&
      value !== "interviews" &&
      value !== "contacts" &&
      value !== "timeline" &&
      value !== "reminders" &&
      value !== "offer"
    ) {
      return;
    }
    const href = jobTabHref(jobId, value, value === "timeline" && hideAuto);
    if (typeof window !== "undefined") {
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === href) return;
    }
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <Tabs key={initialTab} defaultValue={initialTab} onValueChange={onValueChange}>
      <div
        className="w-full min-w-0 max-w-full touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain"
        aria-busy={pending}
      >
        <TabsList aria-label={documentsCopy.tabsLabel} className="h-auto w-max flex-nowrap justify-start">
          <TabsTrigger value="overview" className="flex-none">
            {documentsCopy.overviewTab}
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-none">
            {documentsCopy.documentsTab}
            {documentCount > 0 ? (
              <Badge variant="secondary" className="h-4 px-1.5">
                <span className="sr-only">{documentsCopy.readyVersions(documentCount)}</span>
                <span aria-hidden>{documentCount.toLocaleString("en-CA")}</span>
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="interviews" className="flex-none">
            {interviewsCopy.tab}
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex-none">
            {contactsCopy}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex-none">
            {timelineCopy.tab}
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex-none">
            {remindersCopy.tab}
          </TabsTrigger>
          {showOffer ? (
            <TabsTrigger value="offer" className="flex-none">
              {offerCopy.tab}
            </TabsTrigger>
          ) : null}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

function jobTabHref(jobId: string, tab: JobSectionTab, hideAuto: boolean): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (hideAuto) params.set("events", "manual");
  return `/jobs/${jobId}?${params}`;
}
