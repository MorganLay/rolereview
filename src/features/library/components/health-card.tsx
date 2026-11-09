"use client";

import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";

import { strings } from "@/copy/strings";
import { cn } from "@/lib/utils";

import type {
  HealthCheckId,
  LibraryFocus,
  LibraryFocusKind,
  LibraryHealth,
  ProfileFieldId,
} from "../health";

type HealthCardProps = {
  health: LibraryHealth;
  focus: LibraryFocus | null;
  onOpenField: (field: ProfileFieldId) => void;
  onFocus: (focus: LibraryFocus) => void;
  onClearFocus: () => void;
};

const copy = strings.library.health;
const assist = strings.library.assist;

const CHECKS: readonly HealthCheckId[] = [
  "profile",
  "experience",
  "skills",
  "recentBullets",
  "goodBullets",
];

type NextAction =
  | { kind: "profile"; field: ProfileFieldId; label: string }
  | { kind: "check"; id: HealthCheckId; label: string }
  | { kind: "wording"; count: number }
  | { kind: "evidence"; count: number }
  | { kind: "done"; label: string };

function nextAction(health: LibraryHealth): NextAction {
  const missingField = health.missingProfile[0];
  if (missingField) {
    return {
      kind: "profile",
      field: missingField,
      label: assist.missing[missingField],
    };
  }

  const passed = new Set(health.passed);
  const incomplete = CHECKS.find((id) => id !== "profile" && !passed.has(id));
  if (incomplete) {
    return { kind: "check", id: incomplete, label: copy.checks[incomplete] };
  }

  if (health.weakest.length > 0) {
    return { kind: "wording", count: health.weakest.length };
  }

  if (health.evidenceGaps > 0) {
    return { kind: "evidence", count: health.evidenceGaps };
  }

  return { kind: "done", label: assist.nextDone };
}

function focusFromHealth(
  kind: LibraryFocusKind,
  health: LibraryHealth,
): LibraryFocus | null {
  if (kind === "wording") {
    if (health.weakest.length === 0) return null;
    return {
      kind,
      bulletIds: health.weakest.map((item) => item.id),
      entryIds: [...new Set(health.weakest.map((item) => item.entryId))],
    };
  }
  if (health.evidenceNeeds.length === 0) return null;
  return {
    kind,
    bulletIds: health.evidenceNeeds.map((item) => item.id),
    entryIds: [...new Set(health.evidenceNeeds.map((item) => item.entryId))],
  };
}

export function HealthCard({
  health,
  focus,
  onOpenField,
  onFocus,
  onClearFocus,
}: HealthCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const passed = new Set(health.passed);
  const missing = CHECKS.filter((id) => !passed.has(id));
  const hasDetails =
    health.missingProfile.length > 0 ||
    missing.some((id) => id !== "profile") ||
    health.weakest.length > 0 ||
    health.evidenceGaps > 0;
  const next = nextAction(health);
  const wordingFocus = focusFromHealth("wording", health);
  const evidenceFocus = focusFromHealth("evidence", health);

  function toggleFocus(kind: LibraryFocusKind) {
    const nextFocus = focusFromHealth(kind, health);
    if (!nextFocus) return;
    if (focus?.kind === kind) {
      onClearFocus();
      return;
    }
    onFocus(nextFocus);
  }

  return (
    <section
      className="rounded-[var(--radius-card)] border border-line bg-surface"
      aria-label={copy.stripLabel}
    >
      <div className="grid grid-cols-2 gap-0 lg:grid-cols-4">
        <Metric
          label={copy.title}
          value={copy.percent(health.percent)}
          hint={copy.completenessHint}
          detail={copy.completenessDetail}
          position="tl"
        />
        <Metric
          label={copy.strengthTitle}
          value={copy.strengthValue(health.strongOrBetter, health.bulletCount)}
          hint={copy.strengthHint}
          detail={
            health.bulletCount > 0
              ? copy.strengthSummary(health.strongOrBetter, health.bulletCount)
              : undefined
          }
          position="tr"
        />
        <Metric
          label={copy.opportunitiesTitle}
          value={
            health.weakest.length > 0
              ? copy.opportunitiesValue(health.weakest.length)
              : "0"
          }
          hint={
            health.weakest.length > 0
              ? copy.opportunitiesHint
              : copy.opportunitiesNone
          }
          interactive={Boolean(wordingFocus)}
          active={focus?.kind === "wording"}
          onSelect={wordingFocus ? () => toggleFocus("wording") : undefined}
          selectLabel={assist.focusWording}
          position="bl"
        />
        <Metric
          label={copy.evidenceTitle}
          value={
            health.evidenceGaps > 0
              ? copy.evidenceValue(health.evidenceGaps)
              : "0"
          }
          hint={
            health.evidenceGaps > 0 ? copy.evidenceHint : copy.evidenceNone
          }
          interactive={Boolean(evidenceFocus)}
          active={focus?.kind === "evidence"}
          onSelect={evidenceFocus ? () => toggleFocus("evidence") : undefined}
          selectLabel={assist.focusEvidence}
          position="br"
        />
      </div>

      {focus ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 sm:px-5">
          <p className="text-[0.8125rem] text-ink">
            {focus.kind === "wording"
              ? assist.focusedWording(focus.bulletIds.length)
              : assist.focusedEvidence(focus.bulletIds.length)}
          </p>
          <button
            type="button"
            className="text-[0.8125rem] text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={onClearFocus}
          >
            {assist.clearFocus}
          </button>
        </div>
      ) : next.kind !== "done" ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-4 py-2.5 sm:px-5">
          <span className="text-[0.6875rem] font-medium tracking-wide text-slate uppercase">
            {assist.nextActionLabel}
          </span>
          <NextActionControl
            next={next}
            onOpenField={onOpenField}
            onFocusWording={() => wordingFocus && onFocus(wordingFocus)}
            onFocusEvidence={() => evidenceFocus && onFocus(evidenceFocus)}
          />
        </div>
      ) : null}

      {hasDetails ? (
        <div className="border-t border-line px-4 py-2.5 sm:px-5">
          <button
            type="button"
            className="text-[0.8125rem] text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((value) => !value)}
          >
            {detailsOpen ? copy.collapse : copy.expand}
          </button>
          {detailsOpen ? (
            <div className="mt-2.5 grid gap-2">
              <p className="text-[0.8125rem] leading-relaxed text-slate">{assist.where}</p>
              {health.missingProfile.length > 0 ? (
                <ul className="flex flex-wrap gap-x-3 gap-y-1">
                  {health.missingProfile.map((field) => (
                    <li key={field}>
                      <button
                        type="button"
                        className="text-sm text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        onClick={() => onOpenField(field)}
                      >
                        {assist.missing[field]}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {missing.some((id) => id !== "profile") ? (
                <ul className="grid gap-1">
                  {missing
                    .filter((id) => id !== "profile")
                    .map((id) => (
                      <li key={id} className="text-sm text-slate">
                        {strings.status.missing} · {copy.checks[id]}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function NextActionControl({
  next,
  onOpenField,
  onFocusWording,
  onFocusEvidence,
}: {
  next: Exclude<NextAction, { kind: "done" }>;
  onOpenField: (field: ProfileFieldId) => void;
  onFocusWording: () => void;
  onFocusEvidence: () => void;
}) {
  if (next.kind === "check") {
    return <span className="text-[0.8125rem] text-ink">{assist.nextCheck(next.label)}</span>;
  }

  const label =
    next.kind === "profile"
      ? assist.nextProfile(next.label)
      : next.kind === "wording"
        ? assist.nextWording(next.count)
        : assist.nextEvidence(next.count);

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-[0.8125rem] text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      onClick={() => {
        if (next.kind === "profile") onOpenField(next.field);
        else if (next.kind === "wording") onFocusWording();
        else onFocusEvidence();
      }}
    >
      <span>{label}</span>
      <ArrowRightIcon aria-hidden className="size-3.5 shrink-0" />
    </button>
  );
}

function Metric({
  label,
  value,
  hint,
  detail,
  interactive,
  active,
  onSelect,
  selectLabel,
  position,
}: {
  label: string;
  value: string;
  hint: string;
  detail?: string;
  interactive?: boolean;
  active?: boolean;
  onSelect?: () => void;
  selectLabel?: string;
  position: "tl" | "tr" | "bl" | "br";
}) {
  const body = (
    <>
      <p className="text-[0.6875rem] font-medium tracking-wide text-slate uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-sans text-2xl font-semibold tracking-tight text-ink tabular-nums leading-none">
        {value}
      </p>
      <p className="mt-2 text-[0.8125rem] leading-snug text-slate">{hint}</p>
      {detail ? (
        <p className="mt-0.5 text-[0.75rem] leading-snug text-slate/80">{detail}</p>
      ) : null}
    </>
  );

  const shellClass = cn(
    "min-w-0 px-3.5 py-3.5 sm:px-5",
    position === "tl" && "border-b border-r border-line lg:border-b-0",
    position === "tr" && "border-b border-line lg:border-r lg:border-b-0",
    position === "bl" && "border-r border-line lg:border-r",
    position === "br" && "lg:border-r-0",
    active && "bg-pine-50/70",
  );

  if (interactive && onSelect) {
    return (
      <button
        type="button"
        className={cn(
          shellClass,
          "w-full text-left transition-colors hover:bg-paper/80 focus-visible:bg-paper focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
        aria-pressed={active}
        aria-label={selectLabel}
        onClick={onSelect}
      >
        {body}
      </button>
    );
  }

  return <div className={shellClass}>{body}</div>;
}
