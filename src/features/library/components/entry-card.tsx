import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { formatResumeDateRange } from "@/features/library/dates";

import type { LibraryEntry } from "../types";
import { BulletList } from "./bullet-list";

type EntryCardProps = {
  entry: LibraryEntry;
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
  const url = entry.url ? httpUrl(entry.url) : null;

  return (
    <article className="rounded-lg border border-line p-3" aria-labelledby={`${entry.id}-title`}>
      <h3 id={`${entry.id}-title`} className="text-sm font-medium text-ink">
        {entry.title}
      </h3>
      {place ? <p className="mt-1 text-sm text-slate">{place}</p> : null}
      {dates ? <p className="mt-1 text-sm text-slate">{dates}</p> : null}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block break-all text-sm text-pine underline-offset-4 hover:underline"
        >
          {url}
        </a>
      ) : null}
      <BulletList entryId={entry.id} bullets={entry.bullets} />
      <div className="mt-3 flex flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canMoveUp || moving}
          onClick={() => onMove("up")}
        >
          {copy.moveUp}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canMoveDown || moving}
          onClick={() => onMove("down")}
        >
          {copy.moveDown}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {copy.edit}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
        >
          {strings.common.delete}
        </Button>
      </div>
    </article>
  );
}
