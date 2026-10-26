"use client";

import { ChevronDownIcon, ChevronUpIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { RowActions } from "@/components/row-actions";
import { strings } from "@/copy/strings";
import { formatResumeDateRange } from "@/features/library/dates";

import type { LibraryEntry } from "../types";
import { BulletList } from "./bullet-list";

type EntryCardProps = {
  entry: LibraryEntry;
  skills: readonly string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  moving: boolean;
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
  canMoveUp,
  canMoveDown,
  moving,
  onEdit,
  onDelete,
  onMove,
}: EntryCardProps) {
  const place = [entry.organization, entry.location].filter(Boolean).join(" · ");
  const dates = formatResumeDateRange(
    entry.startDate,
    entry.endDate,
    entry.isCurrent,
    copy.present,
  );
  const meta = [place, dates]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(" · ");
  const url = entry.url ? httpUrl(entry.url) : null;

  return (
    <article className="rounded-lg border border-line p-3" aria-labelledby={`${entry.id}-title`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 id={`${entry.id}-title`} className="text-sm font-medium text-ink">
            {entry.title}
          </h3>
          {meta ? <p className="text-sm text-slate">{meta}</p> : null}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block break-all text-sm text-pine underline-offset-4 hover:underline"
            >
              {url}
            </a>
          ) : null}
        </div>
        <RowActions
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
      <BulletList entryId={entry.id} bullets={entry.bullets} skills={skills} />
    </article>
  );
}
