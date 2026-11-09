"use client";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { RowActions } from "@/components/row-actions";
import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { formatResumeDateRange } from "@/features/library/dates";
import { cn } from "@/lib/utils";

import type { LibraryFocus } from "../health";
import { findOverlappingBullets } from "../overlap";
import type { LibraryEntry } from "../types";
import type { WordingView } from "../wording";
import { BulletList } from "./bullet-list";
import { StrengthenPanel } from "./strengthen-panel";

type EntryCardProps = {
  entry: LibraryEntry;
  skills: readonly string[];
  wordings: readonly WordingView[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  moving: boolean;
  focus?: LibraryFocus | null;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
};

const copy = strings.library.entries;

function httpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return value;
  } catch {
    return null;
  }
  return null;
}

export function EntryCard({
  entry,
  skills,
  wordings,
  canMoveUp,
  canMoveDown,
  moving,
  focus = null,
  onEdit,
  onDelete,
  onMove,
}: EntryCardProps) {
  const focused = Boolean(focus?.entryIds.includes(entry.id));
  const [expanded, setExpanded] = useState(true);
  const [openedFocusKey, setOpenedFocusKey] = useState("");
  const [overlapOpen, setOverlapOpen] = useState(false);
  const [dismissedOverlap, setDismissedOverlap] = useState(false);
  const place = [entry.organization, entry.location].filter(Boolean).join(" · ");
  const dates = formatResumeDateRange(
    entry.startDate,
    entry.endDate,
    entry.isCurrent,
    copy.present,
  );
  const url = entry.url ? httpUrl(entry.url) : null;
  const overlaps = findOverlappingBullets(entry.bullets);
  const showOverlap = overlaps.length > 0 && !dismissedOverlap;
  const contentId = `${entry.id}-content`;
  const focusKey =
    focused && focus ? `${focus.kind}:${focus.bulletIds.join(",")}` : "";
  if (focusKey && focusKey !== openedFocusKey) {
    setOpenedFocusKey(focusKey);
    if (!expanded) setExpanded(true);
  }

  return (
    <article
      id={`entry-${entry.id}`}
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-surface transition-colors",
        focused && "border-pine/40 ring-1 ring-pine/20",
      )}
      aria-labelledby={`${entry.id}-title`}
    >
      <div className="flex items-start gap-3 border-b border-line/80 bg-paper/40 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3
              id={`${entry.id}-title`}
              className="text-[0.96875rem] font-semibold leading-snug text-ink text-balance sm:text-[1.015625rem]"
            >
              {entry.title}
            </h3>
            {entry.bullets.length > 0 ? (
              <span className="text-[0.75rem] text-slate tabular-nums">
                {copy.bulletCount(entry.bullets.length)}
              </span>
            ) : null}
          </div>
          {place || dates ? (
            <div className="mt-1 flex flex-col gap-0.5 text-[0.8125rem] leading-normal text-slate sm:flex-row sm:flex-wrap sm:gap-x-2">
              {place ? <span className="min-w-0">{place}</span> : null}
              {place && dates ? (
                <span aria-hidden className="hidden text-line sm:inline">
                  ·
                </span>
              ) : null}
              {dates ? <span className="shrink-0 tabular-nums">{dates}</span> : null}
            </div>
          ) : null}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all text-[0.8125rem] text-pine underline-offset-4 hover:underline"
            >
              {url}
            </a>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-slate"
            onClick={onEdit}
          >
            {copy.edit}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 text-slate"
            aria-expanded={expanded}
            aria-controls={contentId}
            aria-label={expanded ? copy.collapse : copy.expand}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <ChevronUpIcon aria-hidden className="size-4" />
            ) : (
              <ChevronDownIcon aria-hidden className="size-4" />
            )}
          </Button>
          <RowActions
            layout="menu"
            menuLabel={copy.actionsLabel(entry.title)}
            actions={[
              {
                id: "up",
                label: copy.moveUp,
                ariaLabel: `${copy.moveUp}: ${entry.title}`,
                icon: ChevronUpIcon,
                disabled: !canMoveUp || moving,
                onSelect: () => onMove("up"),
              },
              {
                id: "down",
                label: copy.moveDown,
                ariaLabel: `${copy.moveDown}: ${entry.title}`,
                icon: ChevronDownIcon,
                disabled: !canMoveDown || moving,
                onSelect: () => onMove("down"),
              },
              {
                id: "edit",
                label: copy.edit,
                ariaLabel: `${copy.edit}: ${entry.title}`,
                icon: PencilIcon,
                onSelect: onEdit,
              },
              {
                id: "delete",
                label: strings.common.delete,
                ariaLabel: `${strings.common.delete}: ${entry.title}`,
                icon: Trash2Icon,
                destructive: true,
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      </div>

      {expanded ? (
        <div id={contentId} className="px-4 pt-1 pb-4 sm:px-5">
          {showOverlap ? (
            <div className="mt-3 mb-1 rounded-md border border-line bg-paper px-3.5 py-2.5">
              <p className="text-[0.8125rem] font-medium text-ink">{copy.overlapTitle}</p>
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-slate">
                {copy.overlapBody}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="text-[0.8125rem] text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => setOverlapOpen((value) => !value)}
                  aria-expanded={overlapOpen}
                >
                  {copy.overlapReview}
                </button>
                <button
                  type="button"
                  className="text-[0.8125rem] text-slate underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => setDismissedOverlap(true)}
                >
                  {copy.overlapKeep}
                </button>
              </div>
              {overlapOpen ? (
                <ul className="mt-2.5 grid gap-2.5">
                  {overlaps.map((pair) => (
                    <li key={`${pair.leftId}-${pair.rightId}`} className="grid gap-1">
                      <p className="text-sm text-ink">{pair.leftText}</p>
                      <p className="text-sm text-ink">{pair.rightText}</p>
                      <p className="text-[0.75rem] text-slate">
                        Shared: {pair.shared.slice(0, 6).join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <BulletList
            entryId={entry.id}
            entryKind={entry.kind}
            bullets={entry.bullets}
            skills={skills}
            wordings={wordings}
            focusBulletIds={focused ? focus?.bulletIds : undefined}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line/80 pt-3">
            <StrengthenPanel entryId={entry.id} />
          </div>
        </div>
      ) : null}
    </article>
  );
}
