"use client";

import { useEffect, useState } from "react";

import { strings } from "@/copy/strings";
import { useReducedMotion } from "@/features/insights/components/use-reduced-motion";
import { cn } from "@/lib/utils";

import { ProductFrame } from "./product-shots";

const copy = strings.marketing.home;
const SCENE_MS = 2600;
const COUNT_MS = 1200;

export function HeroLoop() {
  const reduced = useReducedMotion();
  const [scene, setScene] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setScene((current) => (current + 1) % 3);
    }, SCENE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  const shown = reduced ? 2 : scene;

  return (
    <div className="relative" aria-label={copy.heroVisual}>
      <div className={cn(shown === 0 ? "block" : "hidden")}>
        <LibraryScene />
      </div>
      <div className={cn(shown === 1 ? "block" : "hidden")}>
        <ResumeScene />
      </div>
      {shown === 2 ? <MatchScene reduced={reduced} /> : null}
    </div>
  );
}

function LibraryScene() {
  return (
    <ProductFrame label={copy.heroSceneLibrary} alt={copy.shotLibraryAlt}>
      <p className="text-xs font-medium text-ink">Product Designer · North Harbour</p>
      <ul className="mt-2 space-y-2">
        <li className="rounded-button border border-line bg-paper px-2 py-1.5 text-[11px] leading-snug text-ink">
          Shipped a React checkout that cut drop-off by 18% across three product lines.
        </li>
        <li className="rounded-button border border-dashed border-pine bg-pine-50 px-2 py-1.5 text-[11px] leading-snug text-ink">
          Ran weekly research sessions with 24 customers.
        </li>
      </ul>
    </ProductFrame>
  );
}

function ResumeScene() {
  return (
    <ProductFrame label={copy.heroSceneResume} alt={copy.shotResumeAlt}>
      <p className="font-serif text-sm font-semibold text-ink">Jordan Hale</p>
      <p className="text-[11px] text-slate">Product designer</p>
      <ul className="mt-2 space-y-1.5">
        <li className="rounded-button bg-pine-50 px-2 py-1.5 text-[11px] leading-snug text-ink ring-1 ring-pine/20">
          Designed a React checkout used across three product lines, cutting drop-off 18%.
          <span className="mt-1 block text-[10px] text-pine">{copy.roleRefineSource}</span>
        </li>
        <li className="rounded-button bg-paper px-2 py-1.5 text-[11px] leading-snug text-ink">
          Led weekly research with 24 customers and shared findings with growth.
        </li>
      </ul>
    </ProductFrame>
  );
}

function MatchScene({ reduced }: { reduced: boolean }) {
  const score = useCountUp(52, 86, !reduced);
  const ticks = score >= 80 ? 3 : score >= 65 ? 2 : 1;
  const rows = [
    { mark: "✓", cls: "text-pine", text: "Shipped product work" },
    { mark: "✓", cls: "text-pine", text: "Figma and React pairing" },
    { mark: "◐", cls: "text-marigold-700", text: "Public-sector experience" },
  ];

  return (
    <ProductFrame label={copy.heroSceneMatch} alt={copy.shotMatchAlt}>
      <p className="text-xs font-medium tabular-nums text-ink">
        {strings.jobs.documents.matchScore(score)}
      </p>
      <ul className="mt-2 space-y-1.5 text-[11px]">
        {rows.map((row, index) => (
          <li key={row.text} className="flex items-center gap-2">
            <span className={cn("font-medium", ticks > index ? row.cls : "text-slate")}>
              {ticks > index ? row.mark : "○"}
            </span>
            <span className="text-ink">{row.text}</span>
          </li>
        ))}
      </ul>
    </ProductFrame>
  );
}

function useCountUp(from: number, to: number, animate: boolean): number {
  const [value, setValue] = useState(animate ? from : to);

  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / COUNT_MS);
      setValue(Math.round(from + (to - from) * progress));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [animate, from, to]);

  return animate ? value : to;
}
