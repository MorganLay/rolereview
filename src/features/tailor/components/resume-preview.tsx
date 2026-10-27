"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { decodeFitSuggestions, type FitSuggestionHeader } from "@/lib/pdf/fit-header";
import { pdfPageCount } from "@/lib/pdf/pages";
import type { ResumeTemplateId } from "@/lib/pdf/template";

const copy = strings.resumePreview;

type PreviewState =
  | { status: "loading"; key: string }
  | { status: "error"; key: string }
  | {
      status: "ready";
      key: string;
      url: string;
      pageCount: number;
      overByLines: number;
      suggestions: FitSuggestionHeader[];
    };

export function ResumePreview({
  resumeId,
  templateId,
}: {
  resumeId: string;
  templateId: ResumeTemplateId;
}) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${resumeId}:${templateId}:${attempt}`;
  const [state, setState] = useState<PreviewState>({ status: "loading", key: requestKey });
  if (state.key !== requestKey) {
    setState({ status: "loading", key: requestKey });
  }

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const params = new URLSearchParams({ preview: "1", template: templateId });
        const response = await fetch(`/api/resumes/${resumeId}/pdf?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const type = response.headers.get("Content-Type") ?? "";
        if (!response.ok || !type.includes("application/pdf")) {
          if (!controller.signal.aborted) setState({ status: "error", key: requestKey });
          return;
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (controller.signal.aborted) return;
        const pageCount = pdfPageCount(bytes);
        if (pageCount < 1) {
          if (!controller.signal.aborted) setState({ status: "error", key: requestKey });
          return;
        }
        const overRaw = Number(response.headers.get("X-Over-Lines"));
        const overByLines = Number.isInteger(overRaw) && overRaw > 0 ? overRaw : 0;
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setState({
          status: "ready",
          key: requestKey,
          url: objectUrl,
          pageCount,
          overByLines,
          suggestions:
            overByLines > 0
              ? decodeFitSuggestions(response.headers.get("X-Fit-Suggestions"))
              : [],
        });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error", key: requestKey });
      }
    })();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestKey, resumeId, templateId]);

  return (
    <section aria-label={copy.regionLabel} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold text-ink">{copy.title}</h2>
        {state.status === "ready" ? (
          <p className="text-sm text-slate">{copy.pageCount(state.pageCount)}</p>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <p className="text-sm text-slate" aria-live="polite">
          {copy.loading}
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-slate">{copy.failed}</p>
          <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            {copy.retry}
          </Button>
        </div>
      ) : null}

      {state.status === "ready" && state.overByLines > 0 ? (
        <div className="rounded-lg border border-line bg-paper p-3">
          <p className="text-sm font-medium text-ink">{copy.overBy(state.overByLines)}</p>
          {state.suggestions.length > 0 ? (
            <>
              <p className="mt-1 text-sm text-slate">{copy.suggest}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                {state.suggestions.map((item) => (
                  <li key={item.id}>{item.text}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="overflow-hidden rounded-lg border border-line bg-paper p-3">
          <iframe
            title={copy.frameTitle}
            src={state.url}
            className="h-[70dvh] min-h-96 w-full rounded-md border border-line bg-surface"
          />
        </div>
      ) : null}
    </section>
  );
}
