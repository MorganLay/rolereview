import { describe, expect, it } from "vitest";

import type { LibrarySnapshot } from "@/features/library/schemas";
import { experienceGroups } from "@/features/tailor/stints";

type Entry = LibrarySnapshot["entries"][number];

function entry(partial: Pick<Entry, "ref" | "kind" | "title"> & Partial<Entry>): Entry {
  return {
    id: partial.ref,
    organization: null,
    location: null,
    startDate: "2021-05",
    endDate: null,
    isCurrent: true,
    url: null,
    bullets: [],
    ...partial,
  };
}

const takenAt = "2026-11-10T00:00:00.000Z";

function grouped(entries: Entry[]): string[][] {
  return experienceGroups(entries, takenAt).map((group) => group.members.slice().sort());
}

describe("experience identity", () => {
  it("groups imported copies of one internship and one program-officer role", () => {
    const groups = grouped([
      entry({
        ref: "E1",
        kind: "EXPERIENCE",
        title: "Full-Stack Developer Intern",
        organization: "Def Hacks",
        startDate: "2020-11",
        endDate: "2021-03",
        isCurrent: false,
      }),
      entry({
        ref: "E2",
        kind: "EXPERIENCE",
        title: "Full Stack Developer Intern",
        organization: "Defhacks.co",
        startDate: "2020-11",
        endDate: "2021-03",
        isCurrent: false,
      }),
      entry({
        ref: "E3",
        kind: "EXPERIENCE",
        title: "Junior Program Officer, Special Business Returns Processing",
        organization: "Canada Revenue Agency",
      }),
      entry({
        ref: "E4",
        kind: "EXPERIENCE",
        title: "Data Analyst / Program Officer",
        organization: "Canada Revenue Agency",
      }),
    ]);
    expect(groups).toContainEqual(["E1", "E2"]);
    expect(groups).toContainEqual(["E3", "E4"]);
  });

  it("keeps a promotion, a different job, and an undated record separate", () => {
    const groups = grouped([
      entry({
        ref: "E1",
        kind: "EXPERIENCE",
        title: "Software Engineer",
        organization: "Northwind",
        startDate: "2020-01",
        endDate: "2021-12",
        isCurrent: false,
      }),
      entry({
        ref: "E2",
        kind: "EXPERIENCE",
        title: "Senior Software Engineer",
        organization: "Northwind",
        startDate: "2022-01",
        endDate: null,
        isCurrent: true,
      }),
      entry({
        ref: "E3",
        kind: "EXPERIENCE",
        title: "Data Analyst",
        organization: "Northwind",
        startDate: "2022-01",
        endDate: null,
        isCurrent: true,
      }),
      entry({
        ref: "E4",
        kind: "EXPERIENCE",
        title: "Software Engineer",
        organization: "Northwind",
        startDate: null,
        endDate: null,
        isCurrent: false,
      }),
    ]);
    expect(groups).toEqual([]);
  });

  it("groups a repeated project title and leaves a role-versus-project-name pair apart", () => {
    const groups = grouped([
      entry({
        ref: "P1",
        kind: "PROJECT",
        title: "COVID-19 Radiograph Decision Support System",
        startDate: null,
        endDate: null,
        isCurrent: false,
      }),
      entry({
        ref: "P2",
        kind: "PROJECT",
        title: "COVID-19 Radiograph Decision Support",
        startDate: null,
        endDate: null,
        isCurrent: false,
      }),
      entry({
        ref: "P3",
        kind: "PROJECT",
        title: "Crooked Creek Golf Course",
        startDate: null,
        endDate: null,
        isCurrent: false,
      }),
      entry({
        ref: "P4",
        kind: "PROJECT",
        title: "Web Developer",
        organization: "Crooked Creek Golf Course",
        startDate: null,
        endDate: null,
        isCurrent: false,
      }),
    ]);
    expect(groups).toEqual([["P1", "P2"]]);
  });
});
