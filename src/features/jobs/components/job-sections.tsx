"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { strings } from "@/copy/strings";

const documentsCopy = strings.jobs.documents;
const timelineCopy = strings.jobs.timeline;

export type JobSectionTab = "overview" | "documents" | "timeline";

export function JobSections({
  jobId,
  initialTab,
  hideAuto,
  children,
}: {
  jobId: string;
  initialTab: JobSectionTab;
  hideAuto: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onValueChange(value: string) {
    if (value !== "overview" && value !== "documents" && value !== "timeline") return;
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
      <div className="max-w-full overflow-x-auto" aria-busy={pending}>
        <TabsList aria-label={documentsCopy.tabsLabel}>
          <TabsTrigger value="overview">{documentsCopy.overviewTab}</TabsTrigger>
          <TabsTrigger value="documents">{documentsCopy.documentsTab}</TabsTrigger>
          <TabsTrigger value="timeline">{timelineCopy.tab}</TabsTrigger>
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
