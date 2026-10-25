"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/copy/strings";
import { createLetterRevision, setLetterLabel } from "@/features/letters/actions";
import { VERSION_LABEL_MAX } from "@/features/tailor/version";

import { createResumeRevision, setResumeLabel } from "../actions";

const copy = strings.jobs.workspace;

export function VersionNameField({
  kind,
  jobId,
  documentId,
  label,
  placeholder,
}: {
  kind: "resume" | "letter";
  jobId: string;
  documentId: string;
  label: string | null;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(label ?? "");
  const [saved, setSaved] = useState(label ?? "");
  const [pending, setPending] = useState(false);
  const fieldId = `${kind}-version-name-${documentId}`;

  async function save() {
    const next = value.trim();
    if (next === saved || pending) return;
    if (next.length > VERSION_LABEL_MAX) {
      toast.error(copy.labelTooLong);
      return;
    }
    setPending(true);
    const result =
      kind === "resume"
        ? await setResumeLabel({ jobId, resumeId: documentId, label: next }).catch(() => null)
        : await setLetterLabel({ jobId, letterId: documentId, label: next }).catch(() => null);
    setPending(false);
    if (!result?.ok) {
      toast.error(copy.labelFailed);
      return;
    }
    setSaved(result.data.label ?? "");
    setValue(result.data.label ?? "");
    router.refresh();
  }

  return (
    <div className="grid max-w-sm gap-1">
      <Label htmlFor={fieldId} className="text-sm font-normal text-slate">
        {copy.versionName}
      </Label>
      <Input
        id={fieldId}
        value={value}
        maxLength={VERSION_LABEL_MAX}
        placeholder={placeholder}
        aria-describedby={`${fieldId}-hint`}
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          void save();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <p id={`${fieldId}-hint`} className="text-xs text-slate">
        {copy.versionNameHint}
      </p>
    </div>
  );
}

export function SubmittedVersionBanner({
  kind,
  jobId,
  documentId,
  submittedOn,
}: {
  kind: "resume" | "letter";
  jobId: string;
  documentId: string;
  submittedOn: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onCreate() {
    if (pending) return;
    setPending(true);
    const result =
      kind === "resume"
        ? await createResumeRevision({ jobId, resumeId: documentId }).catch(() => null)
        : await createLetterRevision({ jobId, letterId: documentId }).catch(() => null);
    setPending(false);
    if (!result?.ok) {
      toast.error(copy.revisionFailed);
      return;
    }
    const href =
      kind === "resume"
        ? `/jobs/${jobId}/resumes/${result.data.id}`
        : `/jobs/${jobId}/letters/${result.data.id}`;
    router.push(href);
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-pine-50 p-4">
      <p className="text-sm text-ink">{copy.frozenBody(submittedOn)}</p>
      <Button type="button" disabled={pending} aria-busy={pending} onClick={() => void onCreate()}>
        {pending ? copy.creatingRevision : copy.createRevision}
      </Button>
    </div>
  );
}
