"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

import { completeReminder, dismissReminder, snoozeReminder } from "../actions";
import type { ReminderView } from "../reminders";

const copy = strings.jobs.reminders;

export function ReminderList({
  reminders,
  empty,
  showJob,
  listLabel,
}: {
  reminders: ReminderView[];
  empty: string;
  showJob: boolean;
  listLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<{
    id: string;
    action: "complete" | "snooze" | "dismiss";
  } | null>(null);

  async function run(id: string, action: "complete" | "snooze" | "dismiss") {
    if (pending) return;
    setPending({ id, action });
    const result = await (
      action === "complete"
        ? completeReminder
        : action === "snooze"
          ? snoozeReminder
          : dismissReminder
    )({ reminderId: id });
    setPending(null);
    if (!result.ok) {
      toast.error(result.error.code === "NOT_FOUND" ? copy.notFound : copy.actionFailed);
      return;
    }
    toast.success(
      action === "complete" ? copy.completed : action === "snooze" ? copy.snoozed : copy.dismissed,
    );
    router.refresh();
  }

  if (reminders.length === 0) {
    return <p className="text-sm text-slate">{empty}</p>;
  }

  return (
    <ul aria-label={listLabel} className="flex flex-col">
      {reminders.map((reminder) => {
        const busy = pending?.id === reminder.id;
        return (
          <li
            key={reminder.id}
            aria-busy={busy}
            className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-medium break-words text-ink">{reminder.title}</p>
              <p className="text-xs text-slate">
                {copy.kinds[reminder.kind]}
                {" · "}
                <time dateTime={reminder.dueAt}>{reminder.dueLabel}</time>
                {reminder.overdue ? (
                  <span className="text-clay"> · {copy.overdue}</span>
                ) : null}
              </p>
              {showJob && reminder.jobLabel ? (
                <p className="text-sm break-words text-ink">{reminder.jobLabel}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending !== null}
                aria-label={copy.doneFor(reminder.title)}
                onClick={() => void run(reminder.id, "complete")}
              >
                {busy && pending?.action === "complete" ? copy.saving : copy.done}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending !== null}
                aria-label={copy.snoozeFor(reminder.title)}
                onClick={() => void run(reminder.id, "snooze")}
              >
                {busy && pending?.action === "snooze" ? copy.saving : copy.snooze}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending !== null}
                aria-label={copy.dismissFor(reminder.title)}
                onClick={() => void run(reminder.id, "dismiss")}
              >
                {busy && pending?.action === "dismiss" ? copy.saving : copy.dismiss}
              </Button>
              {showJob && reminder.jobId ? (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link
                    href={`/jobs/${reminder.jobId}`}
                    aria-label={copy.openJobFor(reminder.jobLabel ?? reminder.title)}
                  >
                    {copy.openJob}
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CompletedReminderList({ reminders }: { reminders: ReminderView[] }) {
  if (reminders.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-ink">{copy.completedLabel}</h3>
      <ul aria-label={copy.completedLabel} className="flex flex-col">
        {reminders.map((reminder) => (
          <li
            key={reminder.id}
            className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0"
          >
            <p className="text-sm font-medium break-words text-ink">{reminder.title}</p>
            <p className="text-xs text-slate">
              {copy.kinds[reminder.kind]}
              {reminder.completedLabel ? ` · ${copy.doneOn(reminder.completedLabel)}` : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
