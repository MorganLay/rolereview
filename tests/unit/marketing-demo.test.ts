import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { setBulletIncluded } from "@/features/marketing/demo/edit";
import { loadDemoCatalog } from "@/features/marketing/demo/load";
import { DEMO_PERSONAS, DEMO_POSTINGS } from "@/features/marketing/demo/schema";
import { keywordCoverage } from "@/features/tailor/keywords";

describe("marketing demo fixtures", () => {
  const catalog = loadDemoCatalog();

  it("loads the nine persona × posting pairs and nothing else", () => {
    expect(catalog).toHaveLength(DEMO_PERSONAS.length * DEMO_POSTINGS.length);
    const keys = catalog.map((fixture) => `${fixture.persona}__${fixture.posting}`);
    expect(keys).toEqual(
      DEMO_PERSONAS.flatMap((persona) =>
        DEMO_POSTINGS.map((posting) => `${persona}__${posting}`),
      ),
    );
  });

  it("drops keyword coverage when a bullet that uniquely covers a keyword is turned off", () => {
    const dropped = catalog.some((fixture) => {
      const keywords = fixture.analysis.keywords;
      const before = keywordCoverage(fixture.content, fixture.snapshot, keywords);
      return fixture.content.entries.some((entry) =>
        entry.bullets.some((bullet) => {
          if (!bullet.included) return false;
          const after = keywordCoverage(
            setBulletIncluded(fixture.content, entry.ref, bullet.id, false),
            fixture.snapshot,
            keywords,
          );
          return after.pct < before.pct;
        }),
      );
    });
    expect(dropped).toBe(true);
  });
});

describe("marketing demo stays offline", () => {
  it("does not call the model from the demo page or its components", () => {
    const files = [
      ...sourceFiles(path.join(process.cwd(), "src/features/marketing/demo")),
      path.join(process.cwd(), "src/app/(marketing)/demo/page.tsx"),
      path.join(process.cwd(), "src/features/marketing/components/home-page.tsx"),
    ];
    const forbidden = ["runStructured", "@anthropic-ai/sdk", "@/lib/ai/run"];
    for (const file of files) {
      if (file.includes(`${path.sep}fixtures${path.sep}`)) continue;
      const source = readFileSync(file, "utf8");
      for (const token of forbidden) {
        expect(source.includes(token), `${path.basename(file)} mentions ${token}`).toBe(
          false,
        );
      }
    }
  });
});

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "fixtures") continue;
      found.push(...sourceFiles(full));
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) found.push(full);
  }
  return found;
}
