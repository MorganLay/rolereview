"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
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
import { Check, GripVertical, MoreHorizontal, Star } from "lucide-react";
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
import { boardCardMatchText, boardCardSecondaryLine } from "./board-card-line";
import { JobNextActionLink } from "./job-next-action";
import { JobOpenLink } from "./job-open-link";
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
const ALL_STAGES = "ALL";

const MOBILE_QUERY = "(max-width: 767px)";
const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function JobsBoard({
  cards: initial,
  stage: lockedStage = null,
}: {
  cards: BoardCardDisplay[];
  stage?: BoardStage | null;
}) {
  const router = useRouter();
  const stageId = useId();
  const mobile = useMedia(MOBILE_QUERY);
  const reduceMotion = useMedia(REDUCE_MOTION_QUERY);
  const incoming = boardCardsKey(initial);
  const [seen, setSeen] = useState(incoming);
  const [cards, setCards] = useState(initial);
  const [stage, setStage] = useState<BoardStage | typeof ALL_STAGES>("SAVED");
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
  const stages = lockedStage ? [lockedStage] : BOARD_STAGES;
  const showAll = lockedStage === null && stage === ALL_STAGES;
  const singlePhone = lockedStage === null && !showAll;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const activeCard = activeId ? cards.find((card) => card.id === activeId) : undefined;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const edges = useHorizontalEdges(scrollerRef, stages.length + cards.length);

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
    <div className="flex min-w-0 flex-col gap-3" aria-busy={pending}>
      <p className="sr-only" aria-live="polite">
        {pending ? copy.moving : ""}
      </p>
      {lockedStage ? null : (
        <div className="grid shrink-0 gap-2 md:hidden">
          <Label htmlFor={stageId}>{copy.stageLabel}</Label>
          <Select
            value={stage}
            onValueChange={(value) => {
              if (value === ALL_STAGES || isBoardStage(value)) setStage(value);
            }}
          >
            <SelectTrigger id={stageId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STAGES}>{copy.allStages}</SelectItem>
              {BOARD_STAGES.map((value) => (
                <SelectItem key={value} value={value}>
                  {copy.stageOption(stageName(value), stageCount(cards, value))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
        <div className="relative">
          <div
            ref={scrollerRef}
            className={cn(
              "flex w-full min-w-0 max-w-full items-stretch gap-3 pb-3",
              "[scrollbar-width:thin] [scrollbar-color:var(--color-line)_transparent]",
              "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line",
              singlePhone
                ? "max-md:overflow-x-hidden md:overflow-x-auto"
                : "touch-pan-x overflow-x-auto overscroll-x-contain",
            )}
          >
            {stages.map((value) => (
              <BoardColumn
                key={value}
                stage={value}
                cards={cards}
                drag={drag}
                pending={pending}
                selected={lockedStage !== null || showAll || stage === value}
                spread={showAll}
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
          {edges.left ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-paper to-transparent"
            />
          ) : null}
          {edges.right ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-paper to-transparent"
            />
          ) : null}
        </div>
        <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
          {activeCard ? (
            <div aria-hidden className="w-[20rem]">
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
  spread,
  reduceMotion,
  onMove,
  onClose,
}: {
  stage: BoardStage;
  cards: BoardCardDisplay[];
  drag: boolean;
  pending: boolean;
  selected: boolean;
  spread: boolean;
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
        "min-h-64 w-full max-w-full flex-col overflow-hidden rounded-card border border-line",
        "bg-[color-mix(in_srgb,var(--color-line)_42%,var(--color-paper))]",
        "md:flex md:min-h-[30rem] md:w-[20rem] md:min-w-[20rem] md:shrink-0",
        spread ? "w-[20rem] min-w-[20rem] shrink-0" : "w-full",
        selected ? "flex" : "max-md:hidden",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <h2 id={headingId} className="text-sm font-semibold text-ink">
          {stageName(stage)}
        </h2>
        <span className="text-sm text-slate tabular-nums">
          <span aria-hidden>{columnCards.length}</span>
          <span className="sr-only">{copy.jobCount(columnCards.length)}</span>
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2.5 p-2.5",
          isOver && drag && "bg-pine-50/70",
        )}
      >
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
          <p className="px-2 pt-3 text-sm text-slate">{copy.emptyColumn}</p>
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
  const secondary = boardCardSecondaryLine(card.deadlineNote);
  const showFlags = card.submitted || card.archived;

  return (
    <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
      <div className="flex items-start gap-2">
        {drag ? (
          <GripVertical className="mt-1 size-4 shrink-0 text-slate" aria-hidden />
        ) : null}
        <div className="min-w-0 flex-1">
          <JobOpenLink
            href={`/jobs/${card.id}`}
            company={card.company}
            label={card.title}
            textClassName="line-clamp-2"
            className="block text-[15px] leading-snug font-semibold text-ink hover:text-pine"
          />
          <p className="mt-0.5 text-sm text-slate">{card.company}</p>
        </div>
        <PriorityStars priority={card.priority} />
        {onMove && onClose ? (
          <div onPointerDown={(event) => event.stopPropagation()} className="shrink-0">
            <MoveMenu card={card} pending={pending} onMove={onMove} onClose={onClose} />
          </div>
        ) : null}
      </div>
      {card.placeLabel ? (
        <p className="mt-2 text-sm text-slate">{card.placeLabel}</p>
      ) : null}
      {secondary.kind === "deadline" ? (
        <p
          className={cn(
            "mt-2 text-sm",
            secondary.note === "past" ? "text-destructive" : "text-slate",
          )}
        >
          {copy.columns.deadline} {card.deadlineLabel}
          {secondary.note === "soon" ? ` ${copy.soon}` : null}
          {secondary.note === "past" ? ` ${copy.past}` : null}
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate">{boardCardMatchText(card.matchLabel)}</p>
      )}
      {showFlags ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {card.submitted ? (
            <span className="inline-flex items-center gap-1 text-sm text-ink">
              <Check className="size-3.5" aria-hidden />
              {copy.submitted}
            </span>
          ) : null}
          {card.archived ? <Badge variant="outline">{detail.archived}</Badge> : null}
        </div>
      ) : null}
      <JobNextActionLink
        input={{
          jobId: card.id,
          status: card.status,
          analysisReady: card.analysisReady,
          latestReadyResume: card.latestReadyResume,
          hasOffer: card.hasOffer,
        }}
        size="sm"
        variant="link"
        stopPointer
        className="h-auto w-fit justify-start px-0 text-left text-sm whitespace-normal"
      />
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
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={copy.moveToFor(card.company)}
        >
          <MoreHorizontal aria-hidden />
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
    <span
      className="mt-0.5 inline-flex shrink-0 items-center gap-px"
      aria-label={strings.jobs.priorityValue(priority)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn("size-3", n <= priority ? "fill-marigold text-ink" : "text-slate")}
        />
      ))}
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
        card.placeLabel ?? "",
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

function useHorizontalEdges(
  ref: RefObject<HTMLDivElement | null>,
  watch: number,
): { left: boolean; right: boolean } {
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = {
        left: el.scrollLeft > 8,
        right: max - el.scrollLeft > 8,
      };
      setEdges((current) =>
        current.left === next.left && current.right === next.right ? current : next,
      );
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [ref, watch]);
  return edges;
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
