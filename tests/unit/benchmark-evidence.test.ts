import { describe, expect, it } from "vitest";

import { blindTrio, trioPacketHidesIdentity } from "../../benchmarks/lib/blind";
import { estimateThreeArm } from "../../benchmarks/model-led/cost";
import { includeLostToFitting, prepareEvidence } from "../../benchmarks/lib/evidence";
import { careerLibraryInput } from "../../benchmarks/model-led/library";
import { estimateRun } from "../../benchmarks/lib/cost";
import { loadCase } from "../../benchmarks/lib/load";

const PROPOSED = [
  "P006-J047",
  "P011-J052",
  "P012-J037",
  "P014-J055",
  "P001-J001",
  "P008-J024",
  "P010-J028",
  "P013-J040",
  "P016-J050",
  "P017-J043",
] as const;

describe("three-arm evidence", () => {
  it("gives production and model-led the same library, and the direct arm the same source facts", () => {
    for (const id of PROPOSED) {
      const testCase = loadCase(id);
      expect(testCase, id).toBeDefined();
      const prepared = prepareEvidence(testCase!);
      expect(prepared.evidence.job.length).toBeGreaterThan(0);
      expect(prepared.evidence.resume.length).toBeGreaterThan(0);
      expect(prepared.libraryText.length).toBeGreaterThan(0);
      expect(prepared.adapted.snapshot.entries.length).toBeGreaterThan(0);
      expect(careerLibraryInput(prepared.adapted.snapshot).text).toBe(prepared.libraryText);
    }
  });

  it("names an include phrase only when fitting removed the line that carried it", () => {
    expect(
      includeLostToFitting({
        fittedText: "Managed calendars for the dean.",
        dropped: ["Processed payroll and undergraduate budgets."],
        includeEvidence: ["payroll", "calendars"],
      }),
    ).toEqual(["payroll"]);
  });

  it("prices ten cases with a second model-led revision in the worst case", () => {
    const estimate = estimateThreeArm(PROPOSED.length);
    expect(estimate.runOnePassUsd).toBeGreaterThan(2);
    expect(estimate.runOnePassUsd).toBeLessThan(2.1);
    expect(estimate.runWorstUsd).toBeGreaterThan(3.5);
    expect(estimate.runWorstUsd).toBeLessThan(3.6);
    expect(estimate.armCWorstUsd).toBeGreaterThan(estimate.armCOnePassUsd);
    expect(estimateRun(PROPOSED.length)).toBeGreaterThan(2.1);
  });

  it("shuffles three resumes without naming the arm", () => {
    const { packet, key } = blindTrio({
      caseId: "P014-J055",
      runId: "planned",
      job: "Executive assistant",
      originalResume: "Dean support and payroll.",
      production: "Production resume.",
      modelLed: "Model resume.",
      direct: "Direct resume.",
      groundTruthFacts: ["payroll"],
    });
    expect(key.order).toHaveLength(3);
    expect(new Set(key.order).size).toBe(3);
    expect(packet.resumes).toHaveLength(3);
    expect(trioPacketHidesIdentity(packet)).toBe(true);
  });
});