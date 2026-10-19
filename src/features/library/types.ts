import type { EntryKind } from "@/generated/prisma/client";

import type { ProfileLink } from "./schemas";

export type LibraryBullet = {
  id: string;
  text: string;
  sortOrder: number;
};

export type LibraryEntry = {
  id: string;
  kind: EntryKind;
  title: string;
  organization: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  url: string | null;
  sortOrder: number;
  bullets: LibraryBullet[];
};

export type LibrarySkill = {
  id: string;
  name: string;
  category: string | null;
  sortOrder: number;
};

export type LibraryProfile = {
  fullName: string | null;
  headline: string | null;
  email: string;
  phone: string | null;
  location: string | null;
  links: ProfileLink[];
  summary: string | null;
};

export type Library = {
  profile: LibraryProfile;
  entries: LibraryEntry[];
  skills: LibrarySkill[];
};
