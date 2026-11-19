import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, it } from "vitest";

import { main } from "../../scripts/compare-tailor";

describe.skipIf(process.env.LIVE_TAILOR !== "1")("live tailor comparison", () => {
  it("reruns Hootsuite, the reporting analyst, and the modeling role on the saved library", async () => {
    const lines: string[] = [];
    const write = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map((item) => String(item)).join(" "));
      write(...args);
    };
    try {
      await main();
    } finally {
      console.log = write;
      writeFileSync(path.join(tmpdir(), "rolerefine-compare.txt"), lines.join("\n"), "utf8");
    }
  }, 480_000);
});
