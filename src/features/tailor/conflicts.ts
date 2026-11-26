/**
 * Fact conflicts stay unresolved. The display reads both records from the
 * library snapshot. It does not choose a value.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";

import { canonicalizeCareer, unresolvedStintPairs, type StintConflict } from "./canonical";
import { entryElementId } from "./evidence";
import type { ResumeContent } from "./schemas";

type SnapshotEntry = LibrarySnapshot["entries"][number];

const FIELD_LABEL: Record<StintConflict, string> = {
  title: "Title",
  organization: "Employer",
  startDate: "Start date",
  endDate: "End date",
  current: "Whether the role is current",
};

export type ConflictSide = {
  label: string;
  value: string;
  elementId: string;
};

export type FactConflictDetail = {
  id: string;
  role: string;
  field: string;
  sides: ConflictSide[];
};

export function factConflictDetails(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): FactConflictDetail[] {
  const review = content.review ?? [];
  if (review.length === 0) return [];
  const career = canonicalizeCareer(snapshot.entries, snapshot.takenAt);
  const details: FactConflictDetail[] = [];
  const seen = new Set<string>();

  for (const item of review) {
    if (item.reason === "fact_conflict") {
      const stint = career.stints.find(
        (row) => row.canonical === item.ref || row.members.includes(item.ref),
      );
      if (!stint) continue;
      const members = membersOf(stint.members, snapshot);
      for (const field of stint.conflicts) {
        pushConflict(details, seen, `${stint.canonical}:${field}`, members, field, false);
      }
    }
    if (item.reason !== "unresolved_dates") continue;
    const pair =
      unresolvedStintPairs(snapshot.entries, snapshot.takenAt).find((refs) =>
        refs.includes(item.ref),
      ) ?? [];
    const members = membersOf(pair.length > 0 ? pair : [item.ref], snapshot);
    if (members.length < 2) continue;
    pushConflict(
      details,
      seen,
      `dates:${members.map((entry) => entry.ref).join(":")}`,
      members,
      "startDate",
      true,
    );
  }

  return details;
}

function pushConflict(
  details: FactConflictDetail[],
  seen: Set<string>,
  id: string,
  members: readonly SnapshotEntry[],
  field: StintConflict,
  asSpan: boolean,
) {
  if (seen.has(id) || members.length < 2) return;
  const sides = members.map((entry) => ({
    label: roleLabel(entry),
    value: fieldValue(entry, field, asSpan),
    elementId: entryElementId(entry.ref),
  }));
  const unique = new Set(sides.map((side) => side.value));
  if (unique.size < 2) return;
  seen.add(id);
  details.push({
    id,
    role: sides[0]?.label ?? "This role",
    field: asSpan ? "Dates" : FIELD_LABEL[field],
    sides,
  });
}

function membersOf(refs: readonly string[], snapshot: LibrarySnapshot): SnapshotEntry[] {
  return refs.flatMap((ref) => {
    const entry = snapshot.entries.find((item) => item.ref === ref);
    return entry ? [entry] : [];
  });
}

function roleLabel(entry: SnapshotEntry): string {
  const title = entry.title.trim();
  const org = entry.organization?.trim() ?? "";
  if (title && org) return `${title} at ${org}`;
  return title || org || "Untitled record";
}

function fieldValue(entry: SnapshotEntry, field: StintConflict, asSpan: boolean): string {
  if (asSpan) {
    const start = entry.startDate?.trim() || "No start date";
    const end = entry.isCurrent ? "current" : entry.endDate?.trim() || "no end date";
    return `${start} to ${end}`;
  }
  if (field === "title") return entry.title.trim() || "No title";
  if (field === "organization") return entry.organization?.trim() || "No employer";
  if (field === "current") return entry.isCurrent ? "Current" : "Not current";
  if (field === "startDate") return entry.startDate?.trim() || "No start date";
  if (entry.isCurrent) return "Current";
  return entry.endDate?.trim() || "No end date";
}
