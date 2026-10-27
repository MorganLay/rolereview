"use client";

import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon, InfoIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { RowActions } from "@/components/row-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { formatResumeDateRange } from "@/features/library/dates";
import { StrengthMeter } from "@/features/library/components/strength-meter";
import { ENTRY_KINDS, type LibrarySnapshot } from "@/features/library/schemas";
import { saveResumeContent } from "@/features/tailor/actions";
import {
  formatSavedTime,
  resumeSkills,
  type ResumeWorkspaceData,
} from "@/features/tailor/content";
import {
  bulletElementId,
  entryElementId,
  skillElementId,
  SKILLS_SECTION_ID,
} from "@/features/tailor/evidence";
import { includeEvidence } from "@/features/tailor/requirement-state";
import {
  RESUME_LIMITS,
  type ContentBullet,
  type ContentEntry,
  type ResumeContent,
} from "@/features/tailor/schemas";
import type { ResumeTemplateId } from "@/lib/pdf/template";
import { cn } from "@/lib/utils";

import {
  entrySectionId,
  excludedGroupKey,
  excludedSkills,
  sectionJumpTargets,
  splitByIncluded,
  SUMMARY_SECTION_ID,
} from "../workspace-nav";
import { resumeTemplateLabel } from "../template-label";
import { ExcludedGroup } from "./excluded-group";
import { MatchPanel } from "./match-panel";
import { SectionJump } from "./section-jump";
import { ExportAppliedDialog, ResumeExportBar, useResumeExport } from "./resume-export-bar";
import { ResumePreview } from "./resume-preview";
import { useUnsavedChangesWarning } from "./unsaved-changes";
import { SubmittedVersionBanner, VersionNameField } from "./version-chrome";

const SAVE_DELAY_MS = 1500;

const copy = strings.jobs.workspace;
const previewCopy = strings.resumePreview;
const bulletCopy = strings.library.bullets;
const entryCopy = strings.library.entries;
const skillCopy = strings.library.skills;
const profileCopy = strings.library.profile;
type Phase = "saving" | "saved" | "error";
type SnapshotEntry = LibrarySnapshot["entries"][number];
type Direction = "up" | "down";

export function ResumeEditor({ workspace }: { workspace: ResumeWorkspaceData }) {
  const router = useRouter();
  const [content, setContent] = useState(workspace.content);
  const [frozen, setFrozen] = useState(workspace.frozen);
  const [phase, setPhase] = useState<Phase>("saved");
  const [savedAt, setSavedAt] = useState(workspace.savedAt);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const contentRef = useRef(workspace.content);
  const savedRef = useRef(workspace.content);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef<() => Promise<boolean>>(async () => true);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const chainRef = useRef<Promise<boolean> | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const flushing = useRef(false);
  const serverDrift = useRef(false);
  const unmounted = useRef(false);
  const skipBlur = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const summaryId = useId();
  const [tab, setTab] = useState<"resume" | "match" | "export">("resume");
  const [previewing, setPreviewing] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [openExcluded, setOpenExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const pendingScroll = useRef<string | null>(null);
  const exportUi = useResumeExport({
    jobId: workspace.jobId,
    resumeId: workspace.resumeId,
    jobStatus: workspace.jobStatus,
    templateId: workspace.templateId,
    submitted: workspace.submitted,
    frozen,
    onSubmitted: () => {
      setFrozen(true);
      router.refresh();
    },
    templates: workspace.templates,
    snapshot: workspace.snapshot,
    beforeExport: () => flushRef.current(),
    readContent: () => contentRef.current,
  });
  const templateId = exportUi.barProps.templateId;

  const snapshotByRef = new Map(
    workspace.snapshot.entries.map((entry) => [entry.ref, entry]),
  );
  const skillNames = workspace.snapshot.skills.map((skill) => skill.name);

  function dirty() {
    return serverDrift.current || !jsonEqual(contentRef.current, savedRef.current);
  }

  async function saveOnce(): Promise<"saved" | "stale" | "failed"> {
    const payload = contentRef.current;
    inFlight.current = true;
    if (!unmounted.current) setPhase("saving");

    let result: Awaited<ReturnType<typeof saveResumeContent>>;
    try {
      result = await saveResumeContent({
        jobId: workspace.jobId,
        resumeId: workspace.resumeId,
        content: payload,
      });
    } catch {
      result = { ok: false, error: { code: "INTERNAL" } };
    }
    inFlight.current = false;

    const stale = contentRef.current !== payload || queued.current;
    if (!result.ok) {
      if (stale) return "stale";
      if (!unmounted.current) {
        if (result.error.code === "CONFLICT") toast.error(copy.frozenSave);
        setPhase("error");
      }
      return "failed";
    }

    if (stale) {
      if (!jsonEqual(payload, savedRef.current)) serverDrift.current = true;
      return "stale";
    }

    serverDrift.current = false;
    contentRef.current = result.data.content;
    savedRef.current = result.data.content;
    if (!unmounted.current) {
      setContent(result.data.content);
      setSavedAt(result.data.savedAt);
      setPhase("saved");
    }
    return "saved";
  }

  async function runUntilSettled(): Promise<boolean> {
    while (true) {
      queued.current = false;
      if (frozen) return true;
      if (!dirty()) {
        if (!unmounted.current) setPhase("saved");
        if (queued.current) continue;
        return true;
      }

      const outcome = await saveOnce();
      if (outcome === "failed") return false;
      if (!dirty() && !queued.current) return true;
      if (flushing.current || unmounted.current || queued.current) continue;
      schedule();
      if (flushing.current || unmounted.current || queued.current) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        continue;
      }
      return true;
    }
  }

  function persist(): Promise<boolean> {
    if (frozen) return Promise.resolve(true);
    const current = chainRef.current;
    if (current) {
      queued.current = true;
      return current.then((ok) => {
        if (!ok) return false;
        if (dirty() || queued.current) return persist();
        return true;
      });
    }
    const run = runUntilSettled().finally(() => {
      if (chainRef.current === run) chainRef.current = null;
    });
    chainRef.current = run;
    return run;
  }

  async function flushSave(): Promise<boolean> {
    if (frozen) return true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    flushing.current = true;
    try {
      return await persist();
    } finally {
      flushing.current = false;
    }
  }

  function schedule() {
    if (frozen || unmounted.current) return;
    setPhase("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persist();
    }, SAVE_DELAY_MS);
  }

  useEffect(() => {
    persistRef.current = persist;
    flushRef.current = flushSave;
  });

  useUnsavedChangesWarning(() => !frozen && dirty(), copy.unsavedLeave);

  useEffect(() => {
    // Development runs this cleanup once on mount. Reset the flag or autosave never starts.
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void persistRef.current();
      } else if (inFlight.current) {
        queued.current = true;
      }
    };
  }, []);

  useEffect(() => {
    if (!editingId) return;
    editorRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightId]);

  useEffect(() => {
    const id = pendingScroll.current;
    if (!id || tab !== "resume") return;
    pendingScroll.current = null;
    const frame = requestAnimationFrame(() => {
      const node = document.getElementById(id);
      if (node) scrollToElement(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [tab, highlightId, openExcluded]);

  function setExcludedOpen(key: string, open: boolean) {
    setOpenExcluded((current) => {
      if (current.has(key) === open) return current;
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function showEvidence(elementId: string) {
    const key = excludedGroupKey({
      elementId,
      entries: contentRef.current.entries,
      skills: workspace.snapshot.skills,
      includedSkillNames: skillNamesOf(contentRef.current),
    });
    if (key) setExcludedOpen(key, true);
    setPreviewing(false);
    setHighlightId(elementId);
    setTab("resume");
    const node = document.getElementById(elementId);
    if (node && node.getClientRects().length > 0) {
      pendingScroll.current = null;
      scrollToElement(node);
      return;
    }
    pendingScroll.current = elementId;
  }

  function onTab(value: string) {
    if (value === "resume" || value === "match" || value === "export") setTab(value);
  }

  function updateContent(recipe: (current: ResumeContent) => ResumeContent) {
    if (frozen) return;
    const next = recipe(contentRef.current);
    contentRef.current = next;
    setContent(next);
    schedule();
  }

  function retry() {
    void flushSave();
  }

  function beginEdit(bullet: ContentBullet) {
    if (frozen || editingId) return;
    skipBlur.current = false;
    setEditingId(bullet.id);
    setDraft(bullet.text);
    setFieldError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
    setFieldError(null);
  }

  function commitEdit(entryRef: string, bulletId: string, fromBlur: boolean) {
    const text = draft.trim();
    if (text.length === 0) {
      setFieldError(bulletCopy.errors.text);
      return;
    }
    if (text.length > RESUME_LIMITS.bullet) {
      setFieldError(bulletCopy.errors.textLength);
      return;
    }
    if (!fromBlur) skipBlur.current = true;
    const current = contentRef.current.entries
      .find((entry) => entry.ref === entryRef)
      ?.bullets.find((bullet) => bullet.id === bulletId)?.text;
    cancelEdit();
    if (current === text) return;
    updateContent((currentContent) => ({
      ...currentContent,
      entries: currentContent.entries.map((entry) =>
        entry.ref === entryRef
          ? {
              ...entry,
              bullets: entry.bullets.map((bullet) =>
                bullet.id === bulletId ? { ...bullet, text } : bullet,
              ),
            }
          : entry,
      ),
    }));
  }

  function onEditKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    entryRef: string,
    bulletId: string,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      skipBlur.current = true;
      cancelEdit();
      return;
    }
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      commitEdit(entryRef, bulletId, false);
    }
  }

  function onEditBlur(entryRef: string, bulletId: string) {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    commitEdit(entryRef, bulletId, true);
  }

  function setEntryIncluded(ref: string, included: boolean) {
    updateContent((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.ref === ref ? { ...entry, included } : entry,
      ),
    }));
  }

  function setBulletIncluded(entryRef: string, bulletId: string, included: boolean) {
    updateContent((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.ref === entryRef
          ? {
              ...entry,
              bullets: entry.bullets.map((bullet) =>
                bullet.id === bulletId ? { ...bullet, included } : bullet,
              ),
            }
          : entry,
      ),
    }));
  }

  function moveBullet(entryRef: string, bulletId: string, direction: Direction) {
    if (editingId) return;
    updateContent((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.ref !== entryRef) return entry;
        const index = entry.bullets.findIndex((bullet) => bullet.id === bulletId);
        const swap = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || swap < 0 || swap >= entry.bullets.length) return entry;
        const bullets = entry.bullets.slice();
        const currentBullet = bullets[index];
        const neighbor = bullets[swap];
        if (!currentBullet || !neighbor) return entry;
        bullets[index] = neighbor;
        bullets[swap] = currentBullet;
        return { ...entry, bullets };
      }),
    }));
  }

  function addSkill(id: string) {
    const skill = workspace.snapshot.skills.find((item) => item.id === id);
    if (!skill) return;
    updateContent((current) => {
      const names = skillNamesOf(current);
      if (names.includes(skill.name)) return current;
      const skills = resumeSkills(workspace.snapshot, [...names, skill.name]);
      if (!skills) return current;
      return { ...current, skills };
    });
  }

  function includeInResume(refs: readonly string[]) {
    updateContent((current) => includeEvidence(current, workspace.snapshot, refs));
  }

  function removeSkill(name: string) {
    updateContent((current) => {
      const names = skillNamesOf(current).filter((item) => item !== name);
      const skills = resumeSkills(workspace.snapshot, names);
      if (skills) return { ...current, skills };
      return {
        ...current,
        skills: current.skills
          .map((group) => ({
            ...group,
            names: group.names.filter((item) => item !== name),
          }))
          .filter((group) => group.names.length > 0),
      };
    });
  }

  const shownSkills = resumeSkills(workspace.snapshot, skillNamesOf(content)) ?? content.skills;
  const savedLabel = copy.saved(formatSavedTime(savedAt, workspace.timeZone));
  const skillElementByName = new Map<string, string>();
  for (const skill of workspace.snapshot.skills) {
    if (!skillElementByName.has(skill.name)) {
      skillElementByName.set(skill.name, skillElementId(skill.ref));
    }
  }

  function jumpTo(id: string) {
    const node = document.getElementById(id);
    if (!(node instanceof HTMLElement)) return;
    node.focus({ preventScroll: true });
    scrollToElement(node);
  }

  function entryNode(entry: ContentEntry) {
    const facts = snapshotByRef.get(entry.ref);
    if (!facts) return null;
    return (
      <EntryBlock
        key={entry.ref}
        entry={entry}
        facts={facts}
        skills={skillNames}
        highlighted={highlightId === entryElementId(entry.ref)}
        highlightId={highlightId}
        editingId={editingId}
        readOnly={frozen}
        draft={draft}
        fieldError={fieldError}
        editorRef={editorRef}
        onDraft={(value) => {
          setDraft(value);
          if (fieldError) setFieldError(null);
        }}
        onIncluded={(included) => setEntryIncluded(entry.ref, included)}
        onBulletIncluded={(bulletId, included) =>
          setBulletIncluded(entry.ref, bulletId, included)
        }
        onBeginEdit={beginEdit}
        onEditKeyDown={(event, bulletId) => onEditKeyDown(event, entry.ref, bulletId)}
        onEditBlur={(bulletId) => onEditBlur(entry.ref, bulletId)}
        onMove={(bulletId, direction) => moveBullet(entry.ref, bulletId, direction)}
      />
    );
  }

  const jumpTargets = sectionJumpTargets({
    summary: { id: SUMMARY_SECTION_ID, label: copy.summary },
    sections: ENTRY_KINDS.map((kind) => ({
      id: entrySectionId(kind),
      label: entryCopy.kinds[kind].title,
      count: content.entries.filter(
        (entry) => entry.kind === kind && snapshotByRef.has(entry.ref),
      ).length,
    })),
    skills: { id: SKILLS_SECTION_ID, label: skillCopy.title },
  });
  const excludedSkillList = excludedSkills(workspace.snapshot.skills, skillNamesOf(content));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/jobs/${workspace.jobId}`}
            className="inline-flex items-center gap-1 rounded-md text-sm text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            {copy.back}
          </Link>
          <p aria-live="polite" className="text-sm text-slate">
            {phase === "error" ? (
              <button
                type="button"
                className="text-destructive underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={retry}
              >
                {copy.saveFailed}
              </button>
            ) : phase === "saving" ? (
              copy.saving
            ) : (
              savedLabel
            )}
          </p>
          <div className="ml-auto hidden lg:flex">
            <ResumeExportBar {...exportUi.barProps} />
          </div>
        </div>
        <VersionNameField
          kind="resume"
          jobId={workspace.jobId}
          documentId={workspace.resumeId}
          label={workspace.label}
          placeholder={workspace.title}
        />
        {frozen && workspace.submittedOn ? (
          <SubmittedVersionBanner
            kind="resume"
            jobId={workspace.jobId}
            documentId={workspace.resumeId}
            submittedOn={workspace.submittedOn}
          />
        ) : null}
        <h1 className="font-serif text-2xl font-semibold tracking-tight break-words text-ink md:text-3xl">
          {workspace.jobTitle}
        </h1>
        <p className="text-sm text-slate">{workspace.company}</p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate">{copy.templateLook(resumeTemplateLabel(templateId))}</p>
          <Button
            type="button"
            variant="outline"
            className="ml-auto"
            aria-pressed={previewing}
            onClick={() => {
              setPreviewing((open) => !open);
              setTab("resume");
            }}
          >
            {previewing ? previewCopy.back : previewCopy.open}
          </Button>
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto lg:hidden">
        <Tabs value={tab} onValueChange={onTab}>
          <TabsList aria-label={copy.tabsLabel}>
            <TabsTrigger value="resume">{copy.resumeTab}</TabsTrigger>
            <TabsTrigger value="match">{copy.matchTab}</TabsTrigger>
            <TabsTrigger value="export">{copy.exportTab}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "export" ? (
        <div className="flex max-w-lg flex-col items-start gap-3 lg:hidden">
          <p className="text-sm text-slate">{copy.exportBody}</p>
          <ResumeExportBar {...exportUi.barProps} />
        </div>
      ) : null}

      <div className="min-w-0 lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
        <div
          className={cn(
            "flex min-w-0 flex-col lg:col-span-3",
            templateId === "compact" ? "gap-4" : "gap-6",
            !previewing && tab !== "resume" && "max-lg:hidden",
          )}
        >
      {previewing ? (
        <ResumePreview resumeId={workspace.resumeId} templateId={templateId} />
      ) : (
      <>
      <SectionJump label={copy.jumpLabel} targets={jumpTargets} onJump={jumpTo} />
      <ProfileHeader profile={workspace.snapshot.profile} templateId={templateId} />

      <section
        id={SUMMARY_SECTION_ID}
        tabIndex={-1}
        className="grid scroll-mt-20 gap-2 outline-none"
        aria-labelledby={`${summaryId}-heading`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${summaryId}-heading`} className={sectionHeading(templateId)}>
            {copy.summary}
          </h2>
          <IncludeSwitch
            label={copy.includeSummary}
            checked={content.summary.included}
            disabled={frozen}
            onCheckedChange={(included) =>
              updateContent((current) => ({
                ...current,
                summary: { ...current.summary, included },
              }))
            }
          />
        </div>
        <Textarea
          id={summaryId}
          value={content.summary.text}
          maxLength={RESUME_LIMITS.summary}
          rows={4}
          aria-labelledby={`${summaryId}-heading`}
          aria-describedby={`${summaryId}-count`}
          readOnly={frozen}
          className={cn("text-sm", !content.summary.included && "opacity-60")}
          onChange={(event) => {
            const text = event.target.value;
            updateContent((current) => ({
              ...current,
              summary: { ...current.summary, text },
            }));
          }}
        />
        <p id={`${summaryId}-count`} className="text-xs text-slate">
          {copy.count(content.summary.text.length, RESUME_LIMITS.summary)}
        </p>
      </section>

      {ENTRY_KINDS.map((kind) => {
        const entries = content.entries.filter(
          (entry) => entry.kind === kind && snapshotByRef.has(entry.ref),
        );
        if (entries.length === 0) return null;
        const { included, excluded } = splitByIncluded(entries);
        return (
          <section
            key={kind}
            id={entrySectionId(kind)}
            tabIndex={-1}
            className="grid scroll-mt-20 gap-3 outline-none"
          >
            <h2 className={sectionHeading(templateId)}>{entryCopy.kinds[kind].title}</h2>
            {included.map((entry) => entryNode(entry))}
            <ExcludedGroup
              count={excluded.length}
              label={copy.notIncluded(excluded.length)}
              open={openExcluded.has(kind)}
              onOpenChange={(open) => setExcludedOpen(kind, open)}
            >
              {excluded.map((entry) => entryNode(entry))}
            </ExcludedGroup>
          </section>
        );
      })}

      <section
        id={SKILLS_SECTION_ID}
        tabIndex={-1}
        className={cn(
          "grid scroll-mt-20 gap-3 outline-none",
          highlightId === SKILLS_SECTION_ID && "rounded-lg bg-marigold-100 p-2",
        )}
      >
        <h2 className={sectionHeading(templateId)}>{skillCopy.title}</h2>
        {shownSkills.length === 0 ? (
          <p className="text-sm text-slate">{copy.noSkills}</p>
        ) : (
          <div className="grid gap-3">
            {shownSkills.map((group) => (
              <div key={group.category ?? "\0"} className="grid gap-2">
                <h3 className="text-sm text-slate">
                  {group.category ?? skillCopy.uncategorized}
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {group.names.map((name) => {
                    const elementId = skillElementByName.get(name);
                    if (elementId) skillElementByName.delete(name);
                    return (
                    <li
                      key={name}
                      id={elementId}
                      className={cn(
                        "inline-flex scroll-mt-20 items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1 pl-2.5 text-sm text-ink",
                        elementId && highlightId === elementId && "bg-marigold-100",
                      )}
                    >
                      {name}
                      {frozen ? null : (
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-slate hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        aria-label={copy.removeSkill(name)}
                        onClick={() => removeSkill(name)}
                      >
                        <XIcon aria-hidden className="size-3.5" />
                      </button>
                      )}
                    </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        {excludedSkillList.length > 0 ? (
          <ExcludedGroup
            count={excludedSkillList.length}
            label={copy.notIncluded(excludedSkillList.length)}
            open={openExcluded.has("skills")}
            onOpenChange={(open) => setExcludedOpen("skills", open)}
          >
            <ul className="grid gap-2">
              {excludedSkillList.map((skill) => {
                const elementId = skillElementId(skill.ref);
                return (
                  <li
                    key={skill.id}
                    id={elementId}
                    className={cn(
                      "flex scroll-mt-20 items-center justify-between gap-3",
                      highlightId === elementId && "rounded-lg bg-marigold-100 px-2 py-1",
                    )}
                  >
                    <span className="min-w-0 break-words text-sm text-ink">{skill.name}</span>
                    <IncludeSwitch
                      label={copy.includeFor(skill.name)}
                      checked={false}
                      disabled={frozen}
                      onCheckedChange={(included) => {
                        if (included) addSkill(skill.id);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </ExcludedGroup>
        ) : !frozen && workspace.snapshot.skills.length > 0 ? (
          <p className="text-sm text-slate">{copy.skillsAllAdded}</p>
        ) : null}
      </section>
      </>
      )}
        </div>
        <aside
          aria-label={copy.panelLabel}
          className={cn(
            "lg:sticky lg:top-20 lg:col-span-2 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto",
            tab !== "match" && "max-lg:hidden",
          )}
        >
          <MatchPanel
            content={content}
            snapshot={workspace.snapshot}
            score={workspace.match.score}
            verdicts={workspace.match.verdicts}
            requirements={workspace.requirements}
            keywords={workspace.keywords}
            libraryEntries={workspace.libraryEntries}
            jobId={workspace.jobId}
            onEvidence={showEvidence}
            onInclude={frozen ? undefined : includeInResume}
          />
        </aside>
      </div>
      <ExportAppliedDialog {...exportUi.dialogProps} />
    </div>
  );
}

function sectionHeading(templateId: ResumeTemplateId): string {
  return cn(
    "font-medium text-ink",
    templateId === "compact" ? "text-sm" : "text-base",
    templateId === "modern" && "border-b border-pine pb-1 font-serif text-lg",
  );
}

function ProfileHeader({
  profile,
  templateId,
}: {
  profile: LibrarySnapshot["profile"];
  templateId: ResumeTemplateId;
}) {
  const name = profile.fullName?.trim() || null;
  const contact = [profile.location, profile.email, profile.phone]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0);
  const inlineLinks = templateId !== "classic";

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={cn(
              "font-semibold tracking-tight",
              templateId === "modern" ? "font-serif text-2xl" : "font-serif text-xl",
              templateId === "compact" && "text-lg",
              name ? "text-ink" : "text-slate",
            )}
          >
            {name ?? profileCopy.emptyName}
          </h2>
          {profile.headline?.trim() ? (
            <p className="mt-1 text-sm text-slate">{profile.headline.trim()}</p>
          ) : null}
        </div>
        <Link
          href="/library"
          className="rounded-md text-sm text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {profileCopy.edit}
        </Link>
      </div>
      {contact.length > 0 ? (
        <p className="mt-3 text-sm break-words text-ink">{contact.join(" · ")}</p>
      ) : null}
      {profile.links.length > 0 ? (
        <ul className={inlineLinks ? "mt-2 flex flex-wrap gap-x-3 gap-y-1" : "mt-2 grid gap-1"}>
          {profile.links.map((link) => (
            <li key={`${link.label}-${link.url}`}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm break-all text-pine underline-offset-4 hover:underline"
              >
                {link.label.trim() ? `${link.label}: ${link.url}` : link.url}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function EntryBlock({
  entry,
  facts,
  skills,
  highlighted,
  highlightId,
  editingId,
  readOnly,
  draft,
  fieldError,
  editorRef,
  onDraft,
  onIncluded,
  onBulletIncluded,
  onBeginEdit,
  onEditKeyDown,
  onEditBlur,
  onMove,
}: {
  entry: ContentEntry;
  facts: SnapshotEntry;
  skills: readonly string[];
  highlighted: boolean;
  highlightId: string | null;
  editingId: string | null;
  readOnly: boolean;
  draft: string;
  fieldError: string | null;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  onDraft: (value: string) => void;
  onIncluded: (included: boolean) => void;
  onBulletIncluded: (bulletId: string, included: boolean) => void;
  onBeginEdit: (bullet: ContentBullet) => void;
  onEditKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>, bulletId: string) => void;
  onEditBlur: (bulletId: string) => void;
  onMove: (bulletId: string, direction: Direction) => void;
}) {
  const title = facts.title.trim() || copy.untitled;
  const place = [facts.organization, facts.location]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" · ");
  const dates = formatResumeDateRange(
    facts.startDate,
    facts.endDate,
    facts.isCurrent,
    entryCopy.present,
  );
  const url = httpUrl(facts.url);

  return (
    <article
      id={entryElementId(entry.ref)}
      className={cn(
        "scroll-mt-20 rounded-lg border border-line p-3",
        highlighted && "bg-marigold-100",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("min-w-0", !entry.included && "opacity-60")}>
          <h3 className="text-sm font-medium break-words text-ink">{title}</h3>
          {place ? <p className="mt-1 text-sm break-words text-slate">{place}</p> : null}
          {dates ? <p className="mt-1 text-sm text-slate">{dates}</p> : null}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm break-all text-pine underline-offset-4 hover:underline"
            >
              {url}
            </a>
          ) : null}
        </div>
        <IncludeSwitch
          label={copy.includeEntry(title)}
          checked={entry.included}
          disabled={readOnly}
          onCheckedChange={onIncluded}
        />
      </div>
      {entry.bullets.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {entry.bullets.map((bullet, index) => (
            <BulletRow
              key={bullet.id}
              bullet={bullet}
              facts={facts}
              skills={skills}
              highlighted={highlightId === bulletElementId(bullet.id)}
              editing={editingId === bullet.id}
              locked={readOnly || editingId !== null}
              readOnly={readOnly}
              draft={draft}
              fieldError={fieldError}
              editorRef={editorRef}
              canMoveUp={index > 0}
              canMoveDown={index < entry.bullets.length - 1}
              entryIncluded={entry.included}
              onDraft={onDraft}
              onIncluded={(included) => onBulletIncluded(bullet.id, included)}
              onBeginEdit={() => onBeginEdit(bullet)}
              onEditKeyDown={(event) => onEditKeyDown(event, bullet.id)}
              onEditBlur={() => onEditBlur(bullet.id)}
              onMove={(direction) => onMove(bullet.id, direction)}
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
  editing,
  locked,
  readOnly,
  draft,
  fieldError,
  editorRef,
  canMoveUp,
  canMoveDown,
  entryIncluded,
  onDraft,
  onIncluded,
  onBeginEdit,
  onEditKeyDown,
  onEditBlur,
  onMove,
}: {
  bullet: ContentBullet;
  facts: SnapshotEntry;
  skills: readonly string[];
  highlighted: boolean;
  editing: boolean;
  locked: boolean;
  readOnly: boolean;
  draft: string;
  fieldError: string | null;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  entryIncluded: boolean;
  onDraft: (value: string) => void;
  onIncluded: (included: boolean) => void;
  onBeginEdit: () => void;
  onEditKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onEditBlur: () => void;
  onMove: (direction: Direction) => void;
}) {
  const fieldId = useId();
  const sources = bullet.sourceRefs
    .map((ref) => facts.bullets.find((item) => item.ref === ref))
    .filter((item): item is SnapshotEntry["bullets"][number] => item !== undefined);

  return (
    <li
      id={bulletElementId(bullet.id)}
      className={cn(
        "grid scroll-mt-20 gap-1 border-t border-line pt-2",
        highlighted && "bg-marigold-100",
      )}
    >
      <div className="flex flex-wrap items-start gap-1.5">
        <IncludeSwitch
          label={copy.includeBullet(bullet.text)}
          checked={bullet.included}
          disabled={readOnly}
          onCheckedChange={onIncluded}
        />
        <div className="min-w-32 flex-1">
          {editing ? (
            <BulletEditor
              fieldId={fieldId}
              draft={draft}
              fieldError={fieldError}
              editorRef={editorRef}
              onDraft={onDraft}
              onKeyDown={onEditKeyDown}
              onBlur={onEditBlur}
            />
          ) : readOnly ? (
            <p
              className={cn(
                "px-1 py-0.5 text-sm leading-5 break-words whitespace-pre-wrap text-ink",
                !bullet.included || !entryIncluded ? "opacity-60" : "",
              )}
            >
              {bullet.text}
            </p>
          ) : (
            <button
              type="button"
              className={cn(
                "w-full rounded-md px-1 py-0.5 text-left text-sm leading-5 break-words whitespace-pre-wrap text-ink hover:bg-pine-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60",
                !bullet.included || !entryIncluded ? "opacity-60" : "",
              )}
              disabled={locked}
              onClick={onBeginEdit}
            >
              <span className="sr-only">{strings.common.edit}: </span>
              {bullet.text}
            </button>
          )}
        </div>
        {editing ? null : <StrengthMeter text={bullet.text} skills={skills} />}
        <SourceButton title={facts.title.trim() || copy.untitled} sources={sources} />
        {editing || readOnly ? null : (
          <RowActions
            menuLabel={bulletCopy.actionsLabel(bullet.text)}
            actions={[
              {
                id: "up",
                label: bulletCopy.moveUp,
                ariaLabel: `${bulletCopy.moveUpLabel}: ${bullet.text}`,
                icon: ChevronUpIcon,
                disabled: locked || !canMoveUp,
                onSelect: () => onMove("up"),
              },
              {
                id: "down",
                label: bulletCopy.moveDown,
                ariaLabel: `${bulletCopy.moveDownLabel}: ${bullet.text}`,
                icon: ChevronDownIcon,
                disabled: locked || !canMoveDown,
                onSelect: () => onMove("down"),
              },
            ]}
          />
        )}
      </div>
      {editing || !bullet.reverted ? null : (
        <p className="w-fit rounded-full bg-marigold-100 px-2 py-0.5 text-xs text-marigold-700">
          {copy.restored}
        </p>
      )}
    </li>
  );
}

function BulletEditor({
  fieldId,
  draft,
  fieldError,
  editorRef,
  onDraft,
  onKeyDown,
  onBlur,
}: {
  fieldId: string;
  draft: string;
  fieldError: string | null;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  onDraft: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
}) {
  const errorId = `${fieldId}-error`;
  const countId = `${fieldId}-count`;

  return (
    <div className="grid gap-1">
      <Label htmlFor={fieldId} className="sr-only">
        {bulletCopy.label}
      </Label>
      <Textarea
        ref={editorRef}
        id={fieldId}
        value={draft}
        maxLength={RESUME_LIMITS.bullet}
        rows={2}
        className="min-h-12 text-sm"
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? `${countId} ${errorId}` : countId}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      <p id={countId} className="text-xs text-slate">
        {copy.count(draft.length, RESUME_LIMITS.bullet)}
      </p>
      {fieldError ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {fieldError}
        </p>
      ) : null}
    </div>
  );
}

function SourceButton({
  title,
  sources,
}: {
  title: string;
  sources: readonly { ref: string; text: string }[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={copy.source}>
          <InfoIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
        <p className="text-sm font-medium text-ink">{copy.sourceFrom(title)}</p>
        {sources.length === 0 ? (
          <p className="text-sm text-slate">{copy.sourceEmpty}</p>
        ) : (
          <ul className="grid gap-2">
            {sources.map((source) => (
              <li key={source.ref} className="text-sm whitespace-pre-wrap text-ink">
                {source.text}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function IncludeSwitch({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (included: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Label htmlFor={id} className="text-sm font-normal text-slate">
        {copy.include}
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function skillNamesOf(content: ResumeContent): string[] {
  return content.skills.flatMap((group) => group.names);
}

function jsonEqual(left: ResumeContent, right: ResumeContent): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function httpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return value;
  } catch {
    return null;
  }
  return null;
}

function scrollToElement(node: HTMLElement) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
}
