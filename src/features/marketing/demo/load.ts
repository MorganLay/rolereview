import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  DEMO_PERSONAS,
  DEMO_POSTINGS,
  DemoFixture,
  type DemoFixture as Fixture,
} from "./schema";

const FIXTURE_DIR = path.join(
  process.cwd(),
  "src/features/marketing/demo/fixtures",
);

/** The nine pre-generated demos. No model calls. */
export function loadDemoCatalog(): Fixture[] {
  let filenames: string[];
  try {
    filenames = readdirSync(FIXTURE_DIR)
      .filter((name) => name.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    throw new Error("Demo fixtures are missing. Run npm run demo:fixtures.");
  }

  const fixtures = filenames.map((filename) => {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path.join(FIXTURE_DIR, filename), "utf8"));
    } catch {
      throw new Error(`Invalid JSON in demo fixture ${filename}.`);
    }
    const parsed = DemoFixture.safeParse(raw);
    if (!parsed.success) {
      const fields = parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ");
      throw new Error(`Invalid demo fixture ${filename} (${fields}).`);
    }
    return parsed.data;
  });

  const keys = new Set(
    fixtures.map((fixture) => `${fixture.persona}__${fixture.posting}`),
  );
  const missing = DEMO_PERSONAS.flatMap((persona) =>
    DEMO_POSTINGS.filter((posting) => !keys.has(`${persona}__${posting}`)).map(
      (posting) => `${persona}__${posting}`,
    ),
  );
  if (missing.length > 0 || fixtures.length !== DEMO_PERSONAS.length * DEMO_POSTINGS.length) {
    throw new Error(`Demo fixtures incomplete (${missing.join(", ")}).`);
  }

  return fixtures.sort((a, b) => {
    const persona =
      DEMO_PERSONAS.indexOf(a.persona) - DEMO_PERSONAS.indexOf(b.persona);
    if (persona !== 0) return persona;
    return DEMO_POSTINGS.indexOf(a.posting) - DEMO_POSTINGS.indexOf(b.posting);
  });
}

export function demoFixtureDir(): string {
  return FIXTURE_DIR;
}
