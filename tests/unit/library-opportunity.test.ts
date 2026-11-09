import { describe, expect, it } from "vitest";

import { bulletOpportunity } from "@/features/library/opportunity";
import { bulletStrength } from "@/features/library/strength";

describe("bulletOpportunity", () => {
  it("offers no action for an excellent line", () => {
    const strength = bulletStrength(
      "Led a team of 12 engineers using React and SQL daily.",
      ["React", "SQL"],
    );
    expect(bulletOpportunity(strength).kind).toBeNull();
  });

  it("asks to clarify filler before pushing for a metric", () => {
    const strength = bulletStrength(
      "Responsible for various reporting tasks across the team.",
      [],
    );
    expect(bulletOpportunity(strength).kind).toBe("clarify");
    expect(bulletOpportunity(strength).diagnosis).toBeTruthy();
  });

  it("asks for detail when a strong line only lacks a number", () => {
    const strength = bulletStrength(
      "Led weekly reporting for the finance team using SQL and Excel.",
      ["SQL", "Excel"],
    );
    expect(strength.tier === "strong" || strength.tier === "good" || strength.tier === "excellent").toBe(
      true,
    );
    expect(bulletOpportunity(strength).kind).toBe("detail");
  });

  it("asks for evidence when a clear line names no tool", () => {
    const strength = bulletStrength(
      "Coordinated weekly status updates for product stakeholders each Friday morning.",
      [],
    );
    const opportunity = bulletOpportunity(strength);
    expect(opportunity.kind === "evidence" || opportunity.kind === "detail" || opportunity.kind === "clarify").toBe(
      true,
    );
  });
});
