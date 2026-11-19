import { describe, expect, it } from "vitest";

import { runExperiment } from "../../scripts/resume-experiment";

describe("resume experiment", () => {
  it.skipIf(process.env.LIVE_EXPERIMENT !== "1")(
    "compares the current pipeline, a direct model, and editorial-first repair",
    async () => {
      await runExperiment();
      expect(true).toBe(true);
    },
    1_800_000,
  );
});
