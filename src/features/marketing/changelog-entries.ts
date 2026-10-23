import type { ComponentType } from "react";

import WhatsHere, {
  meta as whatsHere,
} from "../../../content/changelog/2026-10-22-whats-here.mdx";

import { sortChangelog, type ChangelogMeta } from "./changelog";

export type ChangelogEntry = ChangelogMeta & {
  Content: ComponentType;
};

const entries: ChangelogEntry[] = [
  {
    title: whatsHere.title,
    date: whatsHere.date,
    Content: WhatsHere,
  },
];

export function changelogEntries(): ChangelogEntry[] {
  return sortChangelog(entries);
}
