"use client";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { strings } from "@/copy/strings";

import type { ReminderView } from "../reminders";
import { ReminderList } from "./reminder-list";

const shell = strings.shell;

export function RemindersBell({ reminders }: { reminders: ReminderView[] }) {
  const count = reminders.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count === 0 ? shell.remindersAria : shell.remindersCount(count)}
        >
          <Bell />
          {count > 0 ? (
            <span
              aria-hidden
              className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-pine px-1 text-xs leading-none font-medium text-paper"
            >
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)] p-3">
        <p className="font-medium text-ink">{shell.remindersTitle}</p>
        <div className="mt-2 max-h-96 overflow-y-auto">
          <ReminderList
            reminders={reminders}
            empty={shell.remindersEmpty}
            showJob
            listLabel={shell.remindersTitle}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
