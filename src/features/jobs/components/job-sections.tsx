"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

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
  children,
}: {
  jobId: string;
  initialTab: JobSectionTab;
  hideAuto: boolean;
  showOffer: boolean;
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
      <div className="w-full min-w-0 max-w-full overflow-x-auto" aria-busy={pending}>
        <TabsList aria-label={documentsCopy.tabsLabel}>
          <TabsTrigger value="overview">{documentsCopy.overviewTab}</TabsTrigger>
          <TabsTrigger value="documents">{documentsCopy.documentsTab}</TabsTrigger>
          <TabsTrigger value="interviews">{interviewsCopy.tab}</TabsTrigger>
          <TabsTrigger value="contacts">{contactsCopy}</TabsTrigger>
          <TabsTrigger value="timeline">{timelineCopy.tab}</TabsTrigger>
          <TabsTrigger value="reminders">{remindersCopy.tab}</TabsTrigger>
          {showOffer ? <TabsTrigger value="offer">{offerCopy.tab}</TabsTrigger> : null}
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
