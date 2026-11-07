import { describe, expect, it } from "vitest";

import {
  ONBOARDING_CLOSED_AGE_MS,
  SCENARIO_NAMES,
  onboardingStamp,
  parseScenario,
  scenarioPlan,
} from "../../prisma/scenarios";

describe("parseScenario", () => {
  it("accepts the five snapshot names", () => {
    for (const name of SCENARIO_NAMES) {
      expect(parseScenario(name)).toBe(name);
    }
  });

  it("rejects anything else", () => {
    expect(parseScenario("full")).toBeNull();
    expect(parseScenario("")).toBeNull();
    expect(parseScenario(null)).toBeNull();
    expect(parseScenario(1)).toBeNull();
  });
});

describe("scenarioPlan", () => {
  it("walks an empty account through a finished search", () => {
    expect(scenarioPlan("new")).toEqual({
      library: "empty",
      hunt: "empty",
      onboarding: "open",
    });
    expect(scenarioPlan("library")).toEqual({
      library: "seed",
      hunt: "empty",
      onboarding: "open",
    });
    expect(scenarioPlan("job")).toEqual({
      library: "seed",
      hunt: "saved-job",
      onboarding: "open",
    });
    expect(scenarioPlan("ready")).toEqual({
      library: "seed",
      hunt: "ready-resume",
      onboarding: "open",
    });
    expect(scenarioPlan("returning")).toEqual({
      library: "seed",
      hunt: "full",
      onboarding: "closed",
    });
  });
});

describe("onboardingStamp", () => {
  const now = new Date("2026-11-06T12:00:00.000Z");

  it("clears the flag while setup is open", () => {
    expect(onboardingStamp("open", now)).toBeNull();
  });

  it("closes setup a week before now", () => {
    expect(onboardingStamp("closed", now)?.toISOString()).toBe(
      new Date(now.getTime() - ONBOARDING_CLOSED_AGE_MS).toISOString(),
    );
  });
});
