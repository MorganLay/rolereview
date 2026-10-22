"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  defaultAnimateLayoutChanges,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Check, GripVertical, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { strings } from "@/copy/strings";
import { cn } from "@/lib/utils";

import { moveJob } from "../actions";
import { boardInsertIndex, dragInsertIndex, planColumnMove } from "../board-order";
import type { BoardCardDisplay } from "../format";
import {
  BOARD_STAGES,
  CLOSED_JOB_STATUSES,
  OPEN_JOB_STATUSES,
  isBoardStage,
  isClosedJobStatus,
  isJobStatus,
  type BoardStage,
  type JobStatusValue,
} from "../schemas";
import { AcceptedCelebration } from "./accepted-celebration";
import { CloseJobDialog } from "./close-job-dialog";

const copy = strings.jobs.board;
const detail = strings.jobs.detail;
const COLUMN_PREFIX = "column:";

const MOBILE_QUERY = "(max-width: 767px)";
const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function JobsBoard({ cards: initial }: { cards: BoardCardDisplay[] }) {
  const router = useRouter();
  const stageId = useId();
  const mobile = useMedia(MOBILE_QUERY);
  const reduceMotion = useMedia(REDUCE_MOTION_QUERY);
  const incoming = boardCardsKey(initial);
  const [seen, setSeen] = useState(incoming);
  const [cards, setCards] = useState(initial);
  const [stage, setStage] = useState<BoardStage>("SAVED");
  const [pending, setPending] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [closeMove, setCloseMove] = useState<{
    jobId: string;
    status: JobStatusValue | null;
  } | null>(null);
  const [acceptedOpen, setAcceptedOpen] = useState(false);

  if (incoming !== seen) {
    setSeen(incoming);
    setCards(initial);
  }

  const drag = !mobile && !pending;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const activeCard = activeId ? cards.find((card) => card.id === activeId) : undefined;

  function onDragStart(event: DragStartEvent) {
    if (!drag) return;
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!drag) return;
    const over = event.over;
    if (!over) return;
    const movingId = String(event.active.id);
    const card = cards.find((item) => item.id === movingId);
    if (!card) return;

    const overId = String(over.id);
    const target = dropTarget(overId, cards);
    if (!target) return;

    if (target.kind === "closed-column") {
      if (isClosedJobStatus(card.status)) {
        placeCard(card, card.status, null);
        return;
      }
      setCloseMove({ jobId: card.id, status: null });
      return;
    }

    if (isClosedJobStatus(target.status) && card.status !== target.status) {
      setCloseMove({ jobId: card.id, status: target.status });
      return;
    }

    const overCardId = overId.startsWith(COLUMN_PREFIX) ? null : overId;
    placeCard(card, target.status, overCardId);
  }

  function placeCard(card: BoardCardDisplay, toStatus: JobStatusValue, overCardId: string | null) {
    const columnIds = orderedColumn(cards, toStatus).map((item) => item.id);
    const index = dragInsertIndex({
      movingId: card.id,
      columnIds,
      overId: overCardId,
    });
    if (index === null) return;
    const others = columnIds.filter((id) => id !== card.id);
    void persistMove(
      card.id,
      toStatus,
      index > 0 ? (others[index - 1] ?? null) : null,
      index < others.length ? (others[index] ?? null) : null,
    );
  }

  function moveToTop(card: BoardCardDisplay, toStatus: JobStatusValue) {
    if (pending || card.status === toStatus) return;
    void persistMove(card.id, toStatus, null, null);
  }

  async function persistMove(
    jobId: string,
    toStatus: JobStatusValue,
    beforeId: string | null,
    afterId: string | null,
    closeReason = "",
  ): Promise<string | undefined> {
    if (pending) return;
    const snapshot = cards;
    const previous = snapshot.find((card) => card.id === jobId)?.status;
    const others = orderedColumn(snapshot, toStatus).filter((card) => card.id !== jobId);
    const index = boardInsertIndex(
      others.map((card) => card.id),
      beforeId,
      afterId,
    );
    const planned = planColumnMove({
      movingId: jobId,
      others: others.map((card) => ({ id: card.id, boardOrder: card.boardOrder })),
      index,
    });
    const orders = new Map(planned.map((row) => [row.id, row.boardOrder]));
    setCards(
      snapshot.map((card) => {
        const boardOrder = orders.get(card.id);
        if (card.id === jobId) {
          return { ...card, status: toStatus, boardOrder: boardOrder ?? card.boardOrder };
        }
        if (boardOrder === undefined) return card;
        return { ...card, boardOrder };
      }),
    );
    setPending(true);
    try {
      const result = await moveJob({
        jobId,
        toStatus,
        beforeId,
        afterId,
        closeReason,
      });
      if (!result.ok) {
        setCards(snapshot);
        const reasonError = result.error.fields?.closeReason?.[0];
        if (reasonError) return reasonError;
        toast.error(copy.moveFailed);
        setCloseMove(null);
        return;
      }
      setCloseMove(null);
      if (toStatus === "ACCEPTED" && previous !== "ACCEPTED") setAcceptedOpen(true);
      router.refresh();
    } catch {
      setCards(snapshot);
      setCloseMove(null);
      toast.error(copy.moveFailed);
    } finally {
      setPending(false);
    }
    return;
  }

  async function confirmClose(reason: string, status: JobStatusValue) {
    if (!closeMove) return;
    const card = cards.find((item) => item.id === closeMove.jobId);
    if (!card || card.status === status) {
      setCloseMove(null);
      return;
    }
    return persistMove(card.id, status, null, null, reason);
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <p className="sr-only" aria-live="polite">
        {pending ? copy.moving : ""}
      </p>
      <div className="grid gap-2 md:hidden">
        <Label htmlFor={stageId}>{copy.stageLabel}</Label>
        <Select
          value={stage}
          onValueChange={(value) => {
            if (isBoardStage(value)) setStage(value);
          }}
        >
          <SelectTrigger id={stageId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOARD_STAGES.map((value) => (
              <SelectItem key={value} value={value}>
                {copy.stageOption(stageName(value), stageCount(cards, value))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{
          screenReaderInstructions: { draggable: copy.dragHint },
        }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-3 overflow-x-auto pb-3">
          {BOARD_STAGES.map((value) => (
            <BoardColumn
              key={value}
              stage={value}
              cards={cards}
              drag={drag}
              pending={pending}
              selected={stage === value}
              reduceMotion={reduceMotion}
              onMove={moveToTop}
              onClose={(card) =>
                setCloseMove({
                  jobId: card.id,
                  status: isClosedJobStatus(card.status) ? card.status : null,
                })
              }
            />
          ))}
        </div>
        <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
          {activeCard ? (
            <div aria-hidden className="w-72">
              <CardBody card={activeCard} drag={false} pending />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CloseJobDialog
        open={closeMove !== null}
        status={closeMove?.status ?? null}
        pickStatus
        pending={pending}
        onOpenChange={(open) => {
          if (!open && !pending) setCloseMove(null);
        }}
        onConfirm={confirmClose}
      />
      <AcceptedCelebration open={acceptedOpen} onOpenChange={setAcceptedOpen} />
    </div>
  );
}

function BoardColumn({
  stage,
  cards,
  drag,
  pending,
  selected,
  reduceMotion,
  onMove,
  onClose,
}: {
  stage: BoardStage;
  cards: BoardCardDisplay[];
  drag: boolean;
  pending: boolean;
  selected: boolean;
  reduceMotion: boolean;
  onMove: (card: BoardCardDisplay, status: JobStatusValue) => void;
  onClose: (card: BoardCardDisplay) => void;
}) {
  const headingId = useId();
  const { setNodeRef, isOver } = useDroppable({
    id: columnId(stage),
    disabled: !drag,
  });
  const columnCards =
    stage === "CLOSED"
      ? CLOSED_JOB_STATUSES.flatMap((status) => orderedColumn(cards, status))
      : orderedColumn(cards, stage);

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "w-full shrink-0 flex-col gap-2 md:flex md:w-72",
        selected ? "flex" : "max-md:hidden",
        isOver && drag && "rounded-lg bg-muted/50",
      )}
    >
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2 id={headingId} className="text-sm font-medium text-ink">
          {stageName(stage)}
        </h2>
        <span className="text-xs text-slate">{copy.jobCount(columnCards.length)}</span>
      </div>
      <div ref={setNodeRef} className="flex min-h-16 flex-col gap-3">
        {stage === "CLOSED" ? (
          CLOSED_JOB_STATUSES.map((status) => (
            <ClosedGroup
              key={status}
              status={status}
              cards={orderedColumn(cards, status)}
              drag={drag}
              pending={pending}
              reduceMotion={reduceMotion}
              onMove={onMove}
              onClose={onClose}
            />
          ))
        ) : (
          <CardList
            cards={columnCards}
            drag={drag}
            pending={pending}
            reduceMotion={reduceMotion}
            onMove={onMove}
            onClose={onClose}
          />
        )}
        {columnCards.length === 0 ? (
          <p className="px-0.5 text-sm text-slate">{copy.emptyColumn}</p>
        ) : null}
      </div>
    </section>
  );
}

function ClosedGroup({
  status,
  cards,
  drag,
  pending,
  reduceMotion,
  onMove,
  onClose,
}: {
  status: (typeof CLOSED_JOB_STATUSES)[number];
  cards: BoardCardDisplay[];
  drag: boolean;
  pending: boolean;
  reduceMotion: boolean;
  onMove: (card: BoardCardDisplay, status: JobStatusValue) => void;
  onClose: (card: BoardCardDisplay) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId(status),
    disabled: !drag || cards.length === 0,
  });
  if (cards.length === 0) return null;

  return (
    <div ref={setNodeRef} className={cn("flex flex-col gap-2", isOver && "rounded-lg bg-muted/40")}>
      <Badge variant="outline" className="w-fit">
        {detail.statuses[status]}
      </Badge>
      <CardList
        cards={cards}
        drag={drag}
        pending={pending}
        reduceMotion={reduceMotion}
        onMove={onMove}
        onClose={onClose}
      />
    </div>
  );
}

function CardList({
  cards,
  drag,
  pending,
  reduceMotion,
  onMove,
  onClose,
}: {
  cards: BoardCardDisplay[];
  drag: boolean;
  pending: boolean;
  reduceMotion: boolean;
  onMove: (card: BoardCardDisplay, status: JobStatusValue) => void;
  onClose: (card: BoardCardDisplay) => void;
}) {
  return (
    <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
      <ul className="flex flex-col gap-2">
        {cards.map((card) => (
          <SortableCard
            key={card.id}
            card={card}
            drag={drag}
            pending={pending}
            reduceMotion={reduceMotion}
            onMove={onMove}
            onClose={onClose}
          />
        ))}
      </ul>
    </SortableContext>
  );
}

function SortableCard({
  card,
  drag,
  pending,
  reduceMotion,
  onMove,
  onClose,
}: {
  card: BoardCardDisplay;
  drag: boolean;
  pending: boolean;
  reduceMotion: boolean;
  onMove: (card: BoardCardDisplay, status: JobStatusValue) => void;
  onClose: (card: BoardCardDisplay) => void;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !drag,
    animateLayoutChanges: reduceMotion ? () => false : defaultAnimateLayoutChanges,
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(isDragging && "opacity-40")}
      style={dragStyle(transform, transition, reduceMotion, drag)}
      {...(drag ? listeners : {})}
    >
      <CardBody
        card={card}
        drag={drag}
        pending={pending}
        onMove={onMove}
        onClose={onClose}
      />
    </li>
  );
}

function CardBody({
  card,
  drag,
  pending,
  onMove,
  onClose,
}: {
  card: BoardCardDisplay;
  drag: boolean;
  pending: boolean;
  onMove?: (card: BoardCardDisplay, status: JobStatusValue) => void;
  onClose?: (card: BoardCardDisplay) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        {drag ? (
          <GripVertical className="mt-0.5 size-4 shrink-0 text-slate" aria-hidden />
        ) : null}
        <div className="min-w-0 flex-1">
          <Link
            href={`/jobs/${card.id}`}
            className="block font-medium break-words text-ink underline-offset-4 hover:underline"
          >
            {card.company}
          </Link>
          <p className="break-words text-sm text-slate">{card.title}</p>
        </div>
        {onMove && onClose ? (
          <div onPointerDown={(event) => event.stopPropagation()} className="shrink-0">
            <MoveMenu card={card} pending={pending} onMove={onMove} onClose={onClose} />
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PriorityStars priority={card.priority} />
        <Badge variant="outline">
          {copy.matchScore} {card.matchLabel}
        </Badge>
        {card.submitted ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink">
            <Check className="size-3.5" aria-hidden />
            {copy.submitted}
          </span>
        ) : null}
        {card.archived ? <Badge variant="outline">{detail.archived}</Badge> : null}
      </div>
      {card.nextKind && card.nextLabel ? (
        <p className="mt-2 text-xs text-slate">
          {card.nextKind === "reminder" ? copy.nextReminder : copy.nextInterview} {card.nextLabel}
        </p>
      ) : null}
      {card.deadlineLabel ? (
        <p className={cn("mt-1 text-xs", card.deadlineNote ? "text-destructive" : "text-slate")}>
          {copy.columns.deadline} {card.deadlineLabel}
          {card.deadlineNote === "soon" ? ` ${copy.soon}` : null}
          {card.deadlineNote === "past" ? ` ${copy.past}` : null}
        </p>
      ) : null}
    </div>
  );
}

function MoveMenu({
  card,
  pending,
  onMove,
  onClose,
}: {
  card: BoardCardDisplay;
  pending: boolean;
  onMove: (card: BoardCardDisplay, status: JobStatusValue) => void;
  onClose: (card: BoardCardDisplay) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          aria-label={copy.moveToFor(card.company)}
        >
          {copy.moveTo}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPEN_JOB_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            disabled={pending || status === card.status}
            onSelect={() => onMove(card, status)}
          >
            {detail.statuses[status]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={() => onClose(card)}>
          {detail.closedGroup}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PriorityStars({ priority }: { priority: number | null }) {
  if (priority === null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-ink">
      <Star aria-hidden className="size-3.5 fill-marigold text-ink" />
      <span aria-hidden>{priority}</span>
      <span className="sr-only">{strings.jobs.priorityValue(priority)}</span>
    </span>
  );
}

function stageName(stage: BoardStage): string {
  return stage === "CLOSED" ? detail.closedGroup : detail.statuses[stage];
}

function stageCount(cards: readonly BoardCardDisplay[], stage: BoardStage): number {
  if (stage === "CLOSED") {
    return cards.filter((card) => isClosedJobStatus(card.status)).length;
  }
  return cards.filter((card) => card.status === stage).length;
}

function orderedColumn(
  cards: readonly BoardCardDisplay[],
  status: JobStatusValue,
): BoardCardDisplay[] {
  return cards
    .filter((card) => card.status === status)
    .sort(
      (a, b) =>
        a.boardOrder - b.boardOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

function columnId(status: string): string {
  return `${COLUMN_PREFIX}${status}`;
}

function dropTarget(
  overId: string,
  cards: readonly BoardCardDisplay[],
): { kind: "closed-column" } | { kind: "status"; status: JobStatusValue } | null {
  if (overId === columnId("CLOSED")) return { kind: "closed-column" };
  if (overId.startsWith(COLUMN_PREFIX)) {
    const status = overId.slice(COLUMN_PREFIX.length);
    return isJobStatus(status) ? { kind: "status", status } : null;
  }
  const card = cards.find((item) => item.id === overId);
  return card ? { kind: "status", status: card.status } : null;
}

function dragStyle(
  transform: { x: number; y: number; scaleX: number; scaleY: number } | null,
  transition: string | undefined,
  reduceMotion: boolean,
  drag: boolean,
): CSSProperties {
  return {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    transition: reduceMotion ? undefined : transition,
    touchAction: drag ? "none" : undefined,
  };
}

function boardCardsKey(cards: readonly BoardCardDisplay[]): string {
  return cards
    .map((card) =>
      [
        card.id,
        card.status,
        card.boardOrder,
        card.company,
        card.title,
        card.priority ?? "",
        card.matchLabel,
        card.submitted ? "1" : "0",
        card.archived ? "1" : "0",
        card.deadlineLabel ?? "",
        card.deadlineNote ?? "",
        card.nextKind ?? "",
        card.nextLabel ?? "",
      ].join("\u001f"),
    )
    .join("\u001e");
}

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setMatches(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [query]);
  return matches;
}
