"use client";

import { InfoIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { strings } from "@/copy/strings";
import { CtaLink } from "@/features/marketing/components/cta-link";
import { useReducedMotion } from "@/features/insights/components/use-reduced-motion";
import { formatResumeDateRange } from "@/features/library/dates";
import { StrengthMeter } from "@/features/library/components/strength-meter";
import { ENTRY_KINDS, type LibrarySnapshot } from "@/features/library/schemas";
import { MatchPanel } from "@/features/tailor/components/match-panel";
import {
  bulletElementId,
  entryElementId,
  skillElementId,
  SKILLS_SECTION_ID,
} from "@/features/tailor/evidence";
import type { ContentBullet, ContentEntry, ResumeContent } from "@/features/tailor/schemas";
import { captureBrowserEvent } from "@/lib/analytics-browser";
import { cn } from "@/lib/utils";

import { setBulletIncluded, setEntryIncluded, setSummaryIncluded } from "./edit";
import {
  DEMO_PERSONAS,
  DEMO_POSTINGS,
  isDemoPersona,
  isDemoPosting,
  type DemoFixture,
  type DemoPersonaId,
  type DemoPostingId,
} from "./schema";

const copy = strings.marketing.demo;
const workspaceCopy = strings.jobs.workspace;
const entryCopy = strings.library.entries;
const skillCopy = strings.library.skills;

const REVEAL_MS = 1200;

type SnapshotEntry = LibrarySnapshot["entries"][number];
type MobileTab = "resume" | "match";

export function DemoExperience({
  demos,
  heading,
}: {
  demos: readonly DemoFixture[];
  heading: "h1" | "h2";
}) {
  const reduced = useReducedMotion();
  const personaId = useId();
  const jobId = useId();
  const [persona, setPersona] = useState<DemoPersonaId>(DEMO_PERSONAS[0]);
  const [posting, setPosting] = useState<DemoPostingId>(DEMO_POSTINGS[0]);
  const [fixture, setFixture] = useState<DemoFixture | null>(null);
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [token, setToken] = useState(0);
  const [tab, setTab] = useState<MobileTab>("resume");
  const [shownScore, setShownScore] = useState<number | null>(null);
  const [reveal, setReveal] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  const targetScore = fixture?.match.score ?? null;
  const requirementCount = fixture?.analysis.requirements.length ?? 0;

  useEffect(() => {
    if (!fixture || reduced) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / REVEAL_MS);
      if (targetScore !== null) setShownScore(Math.round(targetScore * progress));
      setReveal(Math.ceil(progress * requirementCount));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [fixture, token, reduced, targetScore, requirementCount]);

  function clearRun() {
    setFixture(null);
    setContent(null);
    setLive("");
  }

  function onTailor() {
    const next = demos.find((item) => item.persona === persona && item.posting === posting);
    if (!next) return;
    captureBrowserEvent("demo_run", { persona, job: posting });
    setLive("");
    window.setTimeout(() => setLive(`${next.jobLabel}. ${copy.ready}`), 40);
    setFixture(next);
    setContent(structuredClone(next.content));
    setShownScore(reduced || next.match.score === null ? next.match.score : 0);
    setReveal(reduced ? next.analysis.requirements.length : 0);
    setToken((current) => current + 1);
    setTab("resume");
  }

  function showEvidence(elementId: string) {
    setTab("resume");
    setHighlightId(elementId);
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 2000);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(elementId)?.scrollIntoView({
          block: "center",
          behavior: reduced ? "auto" : "smooth",
        });
      });
    });
  }

  const Title = heading === "h1" ? "h1" : "h2";
  const animate = token > 0 && !reduced;

  return (
    <div>
      <Title className="max-w-2xl font-serif text-3xl font-semibold tracking-tight text-ink">
        {copy.title}
      </Title>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={personaId}>{copy.personaLabel}</Label>
          <select
            id={personaId}
            value={persona}
            className="h-11 w-full rounded-button border border-line bg-surface px-3 text-sm text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onChange={(event) => {
              const value = event.target.value;
              if (!isDemoPersona(value) || value === persona) return;
              setPersona(value);
              clearRun();
            }}
          >
            {DEMO_PERSONAS.map((id) => (
              <option key={id} value={id}>
                {copy.personas[id]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={jobId}>{copy.jobLabel}</Label>
          <select
            id={jobId}
            value={posting}
            className="h-11 w-full rounded-button border border-line bg-surface px-3 text-sm text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onChange={(event) => {
              const value = event.target.value;
              if (!isDemoPosting(value) || value === posting) return;
              setPosting(value);
              clearRun();
            }}
          >
            {DEMO_POSTINGS.map((id) => (
              <option key={id} value={id}>
                {jobLabel(demos, id)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4">
        <Button type="button" className="min-h-11 px-4" onClick={onTailor}>
          {copy.tailor}
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      {fixture && content ? (
        <div className="mt-6 rounded-card border border-line bg-paper p-4 sm:p-6">
          <p className="text-sm text-slate">{fixture.jobLabel}</p>
          <div className="mt-4 lg:hidden">
            <Tabs value={tab} onValueChange={(value) => setTab(value === "match" ? "match" : "resume")}>
              <TabsList aria-label={workspaceCopy.tabsLabel}>
                <TabsTrigger value="resume">{workspaceCopy.resumeTab}</TabsTrigger>
                <TabsTrigger value="match">{workspaceCopy.matchTab}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="mt-4 lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
            <div className={cn("lg:col-span-3", tab !== "resume" && "max-lg:hidden")}>
              <DemoResume
                key={token}
                content={content}
                snapshot={fixture.snapshot}
                highlightId={highlightId}
                animate={animate}
                level={heading === "h1" ? "h2" : "h3"}
                onContent={setContent}
              />
            </div>
            <aside
              aria-label={workspaceCopy.panelLabel}
              className={cn("lg:col-span-2", tab !== "match" && "max-lg:hidden")}
            >
              <MatchPanel
                content={content}
                snapshot={fixture.snapshot}
                score={reduced ? fixture.match.score : shownScore}
                verdicts={fixture.match.verdicts}
                requirements={fixture.analysis.requirements}
                keywords={fixture.analysis.keywords}
                libraryEntries={[]}
                jobId="demo"
                readOnly
                headingLevel={heading === "h1" ? "h2" : "h3"}
                revealCount={reduced ? undefined : reveal}
                onEvidence={showEvidence}
              />
            </aside>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate">{copy.prompt}</p>
      )}

      <div className="mt-8">
        <p className="text-sm text-slate">{copy.pregenerated}</p>
        <div className="mt-4">
          <CtaLink location="demo" signedOutLabel={copy.tryYours} />
        </div>
      </div>
    </div>
  );
}

function jobLabel(demos: readonly DemoFixture[], posting: DemoPostingId): string {
  return demos.find((item) => item.posting === posting)?.jobLabel ?? posting;
}

function DemoResume({
  content,
  snapshot,
  highlightId,
  animate,
  level,
  onContent,
}: {
  content: ResumeContent;
  snapshot: LibrarySnapshot;
  highlightId: string | null;
  animate: boolean;
  level: "h2" | "h3";
  onContent: (content: ResumeContent) => void;
}) {
  const SectionHeading = level;
  const EntryHeading = level === "h2" ? "h3" : "h4";
  const skillNames = snapshot.skills.map((skill) => skill.name);
  const factsByRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  const appearAt = content.entries.reduce<{ next: number; byRef: Record<string, number> }>(
    (acc, entry) => ({
      next: acc.next + entry.bullets.length,
      byRef: { ...acc.byRef, [entry.ref]: acc.next },
    }),
    { next: 0, byRef: {} },
  ).byRef;

  return (
    <div className="flex flex-col gap-6">
      <ResumeHeader profile={snapshot.profile} />
      <section className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading className="text-base font-medium text-ink">
            {workspaceCopy.summary}
          </SectionHeading>
          <IncludeSwitch
            label={workspaceCopy.includeSummary}
            checked={content.summary.included}
            onCheckedChange={(included) => onContent(setSummaryIncluded(content, included))}
          />
        </div>
        <p
          className={cn(
            "text-sm whitespace-pre-wrap text-ink",
            !content.summary.included && "opacity-60",
          )}
        >
          {content.summary.text}
        </p>
      </section>

      {ENTRY_KINDS.map((kind) => {
        const entries = content.entries.filter((entry) => entry.kind === kind);
        if (entries.length === 0) return null;
        return (
          <section key={kind} className="grid gap-3">
            <SectionHeading className="text-base font-medium text-ink">
              {entryCopy.kinds[kind].title}
            </SectionHeading>
            {entries.map((entry) => {
              const facts = factsByRef.get(entry.ref);
              if (!facts) return null;
              return (
                <EntryBlock
                  key={entry.ref}
                  entry={entry}
                  facts={facts}
                  skills={skillNames}
                  highlightId={highlightId}
                  animate={animate}
                  appearStart={appearAt[entry.ref] ?? 0}
                  entryLevel={EntryHeading}
                  onIncluded={(included) =>
                    onContent(setEntryIncluded(content, entry.ref, included))
                  }
                  onBulletIncluded={(bulletId, included) =>
                    onContent(setBulletIncluded(content, entry.ref, bulletId, included))
                  }
                />
              );
            })}
          </section>
        );
      })}

      <section id={SKILLS_SECTION_ID} className="grid scroll-mt-20 gap-3">
        <SectionHeading className="text-base font-medium text-ink">
          {skillCopy.title}
        </SectionHeading>
        {content.skills.length === 0 ? (
          <p className="text-sm text-slate">{workspaceCopy.noSkills}</p>
        ) : (
          content.skills.map((group) => (
            <div key={group.category ?? "\0"} className="grid gap-2">
              <p className="text-sm text-slate">
                {group.category ?? skillCopy.uncategorized}
              </p>
              <ul className="flex flex-wrap gap-2">
                {group.names.map((name) => {
                  const skill = snapshot.skills.find((item) => item.name === name);
                  const elementId = skill ? skillElementId(skill.ref) : undefined;
                  return (
                    <li
                      key={name}
                      id={elementId}
                      className={cn(
                        "scroll-mt-20 rounded-full border border-line bg-surface px-2.5 py-1 text-sm text-ink",
                        elementId && highlightId === elementId && "bg-marigold-100",
                      )}
                    >
                      {name}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function ResumeHeader({ profile }: { profile: LibrarySnapshot["profile"] }) {
  const name = profile.fullName?.trim() || workspaceCopy.untitled;
  const contact = [profile.location, profile.email, profile.phone]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" · ");

  return (
    <header>
      <p className="font-serif text-2xl font-semibold tracking-tight text-ink">{name}</p>
      {profile.headline?.trim() ? (
        <p className="mt-1 text-sm text-slate">{profile.headline}</p>
      ) : null}
      {contact ? <p className="mt-1 text-sm break-words text-slate">{contact}</p> : null}
    </header>
  );
}

function EntryBlock({
  entry,
  facts,
  skills,
  highlightId,
  animate,
  appearStart,
  entryLevel,
  onIncluded,
  onBulletIncluded,
}: {
  entry: ContentEntry;
  facts: SnapshotEntry;
  skills: readonly string[];
  highlightId: string | null;
  animate: boolean;
  appearStart: number;
  entryLevel: "h3" | "h4";
  onIncluded: (included: boolean) => void;
  onBulletIncluded: (bulletId: string, included: boolean) => void;
}) {
  const title = facts.title.trim() || workspaceCopy.untitled;
  const place = [facts.organization, facts.location]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" · ");
  const EntryTitle = entryLevel;
  const dates = formatResumeDateRange(
    facts.startDate,
    facts.endDate,
    facts.isCurrent,
    entryCopy.present,
  );

  return (
    <article
      id={entryElementId(entry.ref)}
      className={cn(
        "scroll-mt-20 rounded-lg border border-line bg-surface p-3",
        highlightId === entryElementId(entry.ref) && "bg-marigold-100",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("min-w-0", !entry.included && "opacity-60")}>
          <EntryTitle className="text-sm font-medium break-words text-ink">{title}</EntryTitle>
          {place ? <p className="mt-1 text-sm break-words text-slate">{place}</p> : null}
          {dates ? <p className="mt-1 text-sm text-slate">{dates}</p> : null}
        </div>
        <IncludeSwitch
          label={workspaceCopy.includeEntry(title)}
          checked={entry.included}
          onCheckedChange={onIncluded}
        />
      </div>
      {entry.bullets.length > 0 ? (
        <ul className="mt-3 grid gap-3">
          {entry.bullets.map((bullet, index) => (
            <BulletRow
              key={bullet.id}
              bullet={bullet}
              facts={facts}
              skills={skills}
              highlighted={highlightId === bulletElementId(bullet.id)}
              dimmed={!entry.included || !bullet.included}
              animate={animate}
              delayMs={(appearStart + index) * 70}
              onIncluded={(included) => onBulletIncluded(bullet.id, included)}
            />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function BulletRow({
  bullet,
  facts,
  skills,
  highlighted,
  dimmed,
  animate,
  delayMs,
  onIncluded,
}: {
  bullet: ContentBullet;
  facts: SnapshotEntry;
  skills: readonly string[];
  highlighted: boolean;
  dimmed: boolean;
  animate: boolean;
  delayMs: number;
  onIncluded: (included: boolean) => void;
}) {
  const sources = bullet.sourceRefs
    .map((ref) => facts.bullets.find((item) => item.ref === ref))
    .filter((item): item is SnapshotEntry["bullets"][number] => item !== undefined);

  return (
    <li
      id={bulletElementId(bullet.id)}
      className={cn(
        "grid scroll-mt-20 gap-1 border-t border-line pt-3",
        highlighted && "bg-marigold-100",
      )}
      style={
        animate
          ? { animation: `demo-bullet-in 500ms ease-out ${delayMs}ms both` }
          : undefined
      }
    >
      <div className="flex items-start gap-2">
        <IncludeSwitch
          label={workspaceCopy.includeBullet(bullet.text)}
          checked={bullet.included}
          onCheckedChange={onIncluded}
        />
        <p className={cn("min-w-0 flex-1 text-sm whitespace-pre-wrap text-ink", dimmed && "opacity-60")}>
          {bullet.text}
        </p>
        <SourceButton title={facts.title.trim() || workspaceCopy.untitled} sources={sources} />
      </div>
      {bullet.reverted ? (
        <p className="w-fit rounded-full bg-marigold-100 px-2 py-0.5 text-xs text-marigold-700">
          {workspaceCopy.restored}
        </p>
      ) : null}
      <StrengthMeter text={bullet.text} skills={skills} />
    </li>
  );
}

function SourceButton({
  title,
  sources,
}: {
  title: string;
  sources: readonly { ref: string; text: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            aria-label={workspaceCopy.source}
          >
            <InfoIcon aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
          <p className="text-sm font-medium text-ink">{workspaceCopy.sourceFrom(title)}</p>
          {sources.length === 0 ? (
            <p className="mt-2 text-sm text-slate">{workspaceCopy.sourceEmpty}</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {sources.map((source) => (
                <li key={source.ref} className="text-sm whitespace-pre-wrap text-ink">
                  {source.text}
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function IncludeSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (included: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 shrink-0 items-center gap-2">
      <Label htmlFor={id} className="text-sm font-normal text-slate">
        {workspaceCopy.include}
      </Label>
      <Switch
        id={id}
        checked={checked}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
