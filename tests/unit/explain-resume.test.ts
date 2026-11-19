import { describe, expect, it } from "vitest";

import { assembleResumeContent } from "@/features/tailor/assemble";
import { composeResume } from "@/features/tailor/compose";
import { explainResumeDecisions } from "@/features/tailor/explain";
import { validateTailorOutput } from "@/features/tailor/validate";

import {
  dataEngineerAnalysis,
  editorialSnapshot,
  stuffedDataOutput,
} from "./tailor-editorial-fixture";

describe("resume decision explanation", () => {
  it("states the plan value and why an omit stayed off", () => {
    const snapshot = editorialSnapshot();
    const analysis = dataEngineerAnalysis();
    const guard = validateTailorOutput(stuffedDataOutput(), snapshot, analysis);
    const composition = composeResume({
      output: guard.output,
      snapshot,
      analysis,
      length: "auto",
    });
    const content = assembleResumeContent(
      composition.output,
      snapshot,
      () => "bullet",
      new Map(),
      composition,
    );
    const text = explainResumeDecisions({
      content,
      snapshot,
      title: analysis.title,
      company: analysis.company,
      requirements: analysis.requirements,
      matches: guard.output.requirementMatches,
    });

    expect(text).toContain("How value is assigned");
    expect(text).toContain("LEAD  Junior Program Officer, Canada Revenue Agency");
    expect(text).toContain(
      "It is the only professional evidence for SQL, Excel, and reconciliation.",
    );
    expect(text).toContain("OMIT  Sales Associate, LCBO");
    expect(text).toContain("Retail cash work does not strengthen a data engineering application.");
    expect(text).toContain("The plan marked it omit.");
    expect(text).toContain("r1 — mandatory — must — SQL for reporting and extracts");
    expect(text).toContain("No evidence for: Enterprise ETL pipelines; ERP implementation");
  });
});
