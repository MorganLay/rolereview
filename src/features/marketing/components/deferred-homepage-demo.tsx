"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

import { strings } from "@/copy/strings";

const copy = strings.marketing.demo;

type DemoComponent = ComponentType;

/**
 * The demo bundle (resume workspace, match panel, nine fixtures) stays out of
 * the first load. It starts when this block is within 600px of the viewport.
 */
export function DeferredHomepageDemo() {
  const host = useRef<HTMLDivElement>(null);
  const [Demo, setDemo] = useState<DemoComponent | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    let cancelled = false;
    const load = () => {
      void import("@/features/marketing/demo/homepage-demo").then((mod) => {
        if (!cancelled) setDemo(() => mod.HomepageDemo);
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  if (Demo) return <Demo />;

  return (
    <div ref={host} aria-busy="true" className="min-h-48">
      <h2 className="max-w-2xl font-serif text-3xl font-semibold tracking-tight text-ink">
        {copy.title}
      </h2>
      <p className="mt-4 text-slate">{copy.loading}</p>
    </div>
  );
}
