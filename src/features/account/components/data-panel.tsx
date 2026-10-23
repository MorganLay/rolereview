"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/copy/strings";
import { deleteAccount } from "@/features/account/actions";
import { DELETE_CONFIRMATION } from "@/features/account/schemas";

const copy = strings.settings.data;

export function DataPanel() {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const confirmed = confirmation === DELETE_CONFIRMATION;

  async function onDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || pending) return;
    setPending(true);
    const result = await deleteAccount({ confirmation });
    if (result?.ok === false) {
      setPending(false);
      toast.error(result.error.code === "VALIDATION" ? copy.invalid : copy.error);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="export-heading" className="flex flex-col gap-3">
        <h2 id="export-heading" className="text-base font-medium text-ink">
          {copy.exportTitle}
        </h2>
        <p className="text-sm text-slate">{copy.exportBody}</p>
        <Button asChild className="min-h-11 w-fit">
          <a href="/api/account/export">{copy.export}</a>
        </Button>
      </section>
      <section aria-labelledby="delete-heading" className="flex flex-col gap-3">
        <h2 id="delete-heading" className="text-base font-medium text-ink">
          {copy.deleteTitle}
        </h2>
        <p className="text-sm text-slate">{copy.deleteBody}</p>
        <form onSubmit={onDelete} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-confirmation">{copy.confirmLabel}</Label>
            <Input
              id="delete-confirmation"
              name="confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="h-11 max-w-xs"
            />
          </div>
          <Button
            type="submit"
            variant="destructive"
            className="min-h-11 w-fit"
            disabled={!confirmed || pending}
          >
            {pending ? copy.deleting : copy.delete}
          </Button>
        </form>
      </section>
    </div>
  );
}
