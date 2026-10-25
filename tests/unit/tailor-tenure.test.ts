import { describe, expect, it } from "vitest";

import { snapshotTenure } from "@/features/tailor/tenure";

import { librarySnapshot } from "./tailor-fixture";

describe("snapshotTenure", () => {
  it("rounds Birchlane 2019-08 to 2022-03 down to two years", () => {
    const snapshot = librarySnapshot();
    const intern = snapshot.entries.find((entry) => entry.ref === "E4");
    if (!intern) throw new Error("missing intern entry");
    intern.organization = "Birchlane Studio";
    intern.startDate = "2019-08";
    intern.endDate = "2022-03";
    intern.isCurrent = false;

    const tenure = snapshotTenure(snapshot);
    const birchlane = tenure.organizations.find((org) =>
      org.name.includes("Birchlane"),
    );

    expect(birchlane?.years).toBe(2);
  });

  it("counts a current role through takenAt and floors the total", () => {
    const tenure = snapshotTenure(librarySnapshot());
    const agency = tenure.organizations.find((org) =>
      org.name.includes("Canada Revenue"),
    );

    expect(agency?.years).toBe(3);
    expect(tenure.experienceYears).toBe(3);
  });

  it("treats a year-only start as January and a year-only end as December", () => {
    const snapshot = librarySnapshot();
    const degree = snapshot.entries.find((entry) => entry.ref === "E3");
    if (!degree) throw new Error("missing education entry");
    degree.startDate = "2022";
    degree.endDate = "2026";

    const tenure = snapshotTenure(snapshot);

    expect(tenure.educationYears).toBe(5);
  });

  it("does not count a role shorter than twelve months as a year", () => {
    const snapshot = librarySnapshot();
    const intern = snapshot.entries.find((entry) => entry.ref === "E4");
    if (!intern) throw new Error("missing intern entry");
    intern.startDate = "2022";
    intern.endDate = "2022-08";

    const tenure = snapshotTenure(snapshot);
    const library = tenure.organizations.find((org) =>
      org.name.includes("City Library"),
    );

    expect(library?.years).toBe(0);
  });
});
