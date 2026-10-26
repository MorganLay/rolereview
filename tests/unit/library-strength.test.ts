import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import { LibrarySnapshot } from "@/features/library/schemas";
import {
  bulletStrength,
  CHECK_IDS,
  filledSegments,
  KNOWN_TERMS,
  type CheckId,
  type StrengthTier,
} from "@/features/library/strength";
import { STRONG_VERB_LIST, STRONG_VERBS } from "@/features/library/verbs";
import { SEED_LIBRARY } from "../../prisma/library-seed";

const EXCELLENT = "Led a team of 12 engineers using React and SQL daily.";
const fixes = strings.strength.fixes;

function padded(total: number): string {
  const words = EXCELLENT.split(/\s+/);
  while (words.length < total) words.push("extra");
  return words.slice(0, total).join(" ");
}

const cases: Array<{
  name: string;
  text: string;
  skills?: string[];
  passed: CheckId[];
}> = [
  { name: "empty", text: "", passed: ["voice", "filler"] },
  { name: "whitespace", text: "   \n\t  ", passed: ["voice", "filler"] },
  { name: "punctuation only", text: "...", passed: ["voice", "filler"] },
  {
    name: "responsible opener",
    text: "Responsible for weekly status updates and team notes.",
    passed: ["length", "voice"],
  },
  {
    name: "helped opener",
    text: "Helped a team of 12 engineers using React and SQL daily.",
    passed: ["metric", "length", "voice", "filler", "specific"],
  },
  {
    name: "worked on",
    text: "Worked on a team of 12 engineers using React and SQL daily.",
    passed: ["metric", "length", "voice", "specific"],
  },
  {
    name: "assisted opener",
    text: "Assisted a team of 12 engineers using React and SQL daily.",
    passed: ["metric", "length", "voice", "filler", "specific"],
  },
  {
    name: "tasked with",
    text: "Tasked with 12 React and SQL releases for the platform team daily.",
    passed: ["metric", "length", "voice", "specific"],
  },
  { name: "excellent past", text: EXCELLENT, passed: [...CHECK_IDS] },
  {
    name: "excellent present",
    text: "Lead a team of 12 engineers using React and SQL daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "verb punctuation",
    text: "Led, a team of 12 engineers using React and SQL daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "canadian spelling",
    text: "Analysed a dataset of 12 million rows using Python and SQL daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "hyphenated verb",
    text: "Co-founded a React platform that served 12k users and cut deploy time.",
    passed: [...CHECK_IDS],
  },
  {
    name: "lowercase tools",
    text: "Led a team of 12 engineers using react and sql daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "first person I",
    text: "I built a React dashboard that cut weekly reporting time by 40% for finance.",
    passed: ["metric", "length", "filler", "specific"],
  },
  {
    name: "contraction I'm",
    text: "I'm shipping React and SQL tools for 12 internal platform teams daily.",
    passed: ["metric", "length", "filler", "specific"],
  },
  {
    name: "curly apostrophe",
    text: "I’m shipping React and SQL tools for 12 internal platform teams daily.",
    passed: ["metric", "length", "filler", "specific"],
  },
  {
    name: "first person we",
    text: "We reduced deploy time by 40% with a GitHub pipeline for internal teams.",
    passed: ["metric", "length", "filler", "specific"],
  },
  {
    name: "first person our",
    text: "Our React rewrite cut page load by 2x for 8 product teams this year.",
    passed: ["metric", "length", "filler", "specific"],
  },
  {
    name: "first person my",
    text: "My SQL reports saved 10 hours a week for the finance analytics team.",
    passed: ["metric", "length", "filler", "specific"],
  },
  {
    name: "first person me",
    text: "Led with me on 12 React and SQL releases for the platform team daily.",
    passed: ["verb", "metric", "length", "filler", "specific"],
  },
  {
    name: "image is not me",
    text: "Led image processing for 12 React engineers using SQL daily now.",
    passed: [...CHECK_IDS],
  },
  {
    name: "your is not our",
    text: "Led a team of 12 engineers using React for your SQL daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "i.e. is not I",
    text: "Led the API, i.e. the public routes, for 12 React teams using SQL.",
    passed: [...CHECK_IDS],
  },
  {
    name: "us is not first person",
    text: "Led a team of 12 engineers showing us React and SQL daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "seven words",
    text: padded(7),
    passed: ["verb", "metric", "voice", "filler"],
  },
  { name: "eight words", text: padded(8), passed: [...CHECK_IDS] },
  { name: "thirty-two words", text: padded(32), passed: [...CHECK_IDS] },
  {
    name: "thirty-three words",
    text: padded(33),
    passed: ["verb", "metric", "voice", "filler", "specific"],
  },
  {
    name: "spelled-out number",
    text: "Led a team of two engineers using React and SQL daily.",
    passed: ["verb", "length", "voice", "filler", "specific"],
  },
  {
    name: "percent",
    text: "Led a team that cut churn 50% using React and SQL tools daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "dollar",
    text: "Led a team that saved $4 million using React and SQL tools daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "multiplier",
    text: "Led a team that grew revenue 2x using React and SQL tools daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "spaced multiplier",
    text: "Led a team that grew revenue 2 x using React and SQL tools.",
    passed: [...CHECK_IDS],
  },
  {
    name: "comma number",
    text: "Led a team that processed 1,000 React and SQL tickets daily.",
    passed: [...CHECK_IDS],
  },
  {
    name: "filler responsible for",
    text: "Led a team responsible for 12 React services and SQL reports daily.",
    passed: ["verb", "metric", "length", "voice", "specific"],
  },
  {
    name: "filler duties included",
    text: "Led duties included 12 React and SQL tasks for the platform team today.",
    passed: ["verb", "metric", "length", "voice", "specific"],
  },
  {
    name: "filler various",
    text: "Led various React and SQL migrations for 12 platform teams this year.",
    passed: ["verb", "metric", "length", "voice", "specific"],
  },
  {
    name: "filler etc",
    text: "Led a team of 12 engineers using React, SQL, etc.",
    passed: ["verb", "metric", "length", "voice", "specific"],
  },
  {
    name: "filler helped with",
    text: "Led and helped with 12 React and SQL releases for the platform team.",
    passed: ["verb", "metric", "length", "voice", "specific"],
  },
  {
    name: "filler worked on",
    text: "Led and worked on 12 React and SQL releases for the platform team.",
    passed: ["verb", "metric", "length", "voice", "specific"],
  },
  {
    name: "one-letter skill misses a longer word",
    text: "Improved caching reviews for twelve colleagues across the office this year.",
    skills: ["C"],
    passed: ["verb", "length", "voice", "filler"],
  },
  {
    name: "one-letter skill matches its own word",
    text: "Improved C reviews for twelve colleagues across the office this year.",
    skills: ["C"],
    passed: ["verb", "length", "voice", "filler", "specific"],
  },
  {
    name: "skill misses a longer word",
    text: "Improved catalog reviews for twelve colleagues across the office this year.",
    skills: ["Cat"],
    passed: ["verb", "length", "voice", "filler"],
  },
  {
    name: "skill matches its own word",
    text: "Improved Cat reviews for twelve colleagues across the office this year.",
    skills: ["Cat"],
    passed: ["verb", "length", "voice", "filler", "specific"],
  },
  {
    name: "go misses going",
    text: "Improved going reviews for twelve colleagues across the office this year.",
    passed: ["verb", "length", "voice", "filler"],
  },
  {
    name: "go matches",
    text: "Improved Go reviews for twelve colleagues across the office this year.",
    passed: ["verb", "length", "voice", "filler", "specific"],
  },
  {
    name: "r misses for",
    text: "Improved for reviews for twelve colleagues across the office this year.",
    passed: ["verb", "length", "voice", "filler"],
  },
  {
    name: "multi-word skill",
    text: "Improved customer onboarding for twelve colleagues across the office this year.",
    skills: ["customer onboarding"],
    passed: ["verb", "length", "voice", "filler", "specific"],
  },
  {
    name: "multi-word skill absent",
    text: "Improved customer onboarding for twelve colleagues across the office this year.",
    passed: ["verb", "length", "voice", "filler"],
  },
  {
    name: "javascript is its own term",
    text: "Improved JavaScript reviews for twelve colleagues across the office this year.",
    skills: ["Java"],
    passed: ["verb", "length", "voice", "filler", "specific"],
  },
  {
    name: "blank skill is ignored",
    text: "Improved reviews for twelve colleagues across the office this year.",
    skills: ["  "],
    passed: ["verb", "length", "voice", "filler"],
  },
  {
    name: "processed opener",
    text: "Processed 40 loan files in Excel for the branch team each morning.",
    passed: [...CHECK_IDS],
  },
  {
    name: "prepared opener",
    text: "Prepared the weekly Excel pack for 12 branch managers every Monday.",
    passed: [...CHECK_IDS],
  },
  {
    name: "one of is not a figure",
    text: "Led one of the React and SQL platform teams each week.",
    passed: ["verb", "length", "voice", "filler", "specific"],
  },
  {
    name: "one-off is not a figure",
    text: "Built one-off Excel exports for the branch team this year.",
    passed: ["verb", "length", "voice", "filler", "specific"],
  },
];

describe("bulletStrength", () => {
  it("covers at least 30 table cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  it.each(cases)("$name", ({ text, skills = [], passed }) => {
    const result = bulletStrength(text, skills);
    expect(result.passed).toEqual(passed);
    expect(result.score).toBe(passed.length);
    expect(result.tier).toBe(
      passed.length <= 2
        ? "weak"
        : passed.length === 3
          ? "fair"
          : passed.length === 4
            ? "good"
            : passed.length === 5
              ? "strong"
              : "excellent",
    );
    expect(result.fixes).toHaveLength(CHECK_IDS.length - passed.length);
  });
});

describe("strength fixes", () => {
  it("lists every miss and names Fair when nothing passes", () => {
    const fair = strings.strength.fair;
    expect(bulletStrength("I was responsible for various tasks etc.", []).fixes).toEqual([
      fixes.verb(fair),
      fixes.metric(fair),
      fixes.lengthShort(fair),
      fixes.voice(fair),
      fixes.filler("responsible for", fair),
      fixes.specific(fair),
    ]);
  });

  it("names Fair while the bullet is still Weak", () => {
    const fair = strings.strength.fair;
    expect(bulletStrength("Hello there friend from town today.", []).fixes).toEqual([
      fixes.verb(fair),
      fixes.metric(fair),
      fixes.lengthShort(fair),
      fixes.specific(fair),
    ]);
  });

  it("names Good from Fair", () => {
    const good = strings.strength.good;
    expect(
      bulletStrength("Hello there friend from town today please now.", []).fixes,
    ).toEqual([fixes.verb(good), fixes.metric(good), fixes.specific(good)]);
  });

  it("names Excellent for the one missing check on a Strong bullet", () => {
    const excellent = strings.strength.excellent;
    expect(
      bulletStrength("Led a team of two engineers using React and SQL daily.", []).fixes,
    ).toEqual([fixes.metricDigit(excellent)]);
  });

  it("asks for a digit when the figure is already written as a word", () => {
    expect(fixes.metricDigit("Excellent")).toBe(
      "Write that figure as a digit to reach Excellent.",
    );
  });

  it("does not treat one of or one-off as a figure to digitize", () => {
    const excellent = strings.strength.excellent;
    expect(
      bulletStrength("Led one of the React and SQL platform teams each week.", []).fixes,
    ).toEqual([fixes.metric(excellent)]);
    expect(
      bulletStrength("Built one-off Excel exports for the branch team this year.", []).fixes,
    ).toEqual([fixes.metric(excellent)]);
  });

  it("picks an example for the first failing check and none when every check passes", () => {
    const examples = strings.strength.examples;
    expect(bulletStrength("Hello there friend from town today.", []).example).toBe(examples.verb);
    expect(
      bulletStrength("Led a team of two engineers using React and SQL daily.", []).example,
    ).toBe(examples.metricDigit);
    expect(
      bulletStrength("Led one of the React and SQL platform teams each week.", []).example,
    ).toBe(examples.metric);
    expect(bulletStrength(EXCELLENT, []).example).toBeNull();
    expect(examples.metric).toContain("[a number you have]");
    expect(examples.metric).not.toMatch(/\d/);
    for (const example of Object.values(examples)) {
      expect(example).not.toMatch(/^Add a (number|metric)\b/i);
    }
  });

  it("never tells you to add a number outright", () => {
    const samples = [
      fixes.verb("Strong"),
      fixes.metric("Strong"),
      fixes.metricDigit("Strong"),
      fixes.lengthShort("Strong"),
      fixes.lengthLong("Strong"),
      fixes.voice("Strong"),
      fixes.filler("responsible for", "Strong"),
      fixes.specific("Strong"),
    ];
    expect(fixes.metric("Strong")).toBe(
      "If you have a number for this, add it to reach Strong.",
    );
    for (const sample of samples) {
      expect(sample).not.toMatch(/^Add a (number|metric)\b/i);
    }
  });

  it("quotes the filler phrase", () => {
    expect(
      bulletStrength("Led a team of 12 engineers using React, SQL, etc.", []).fixes,
    ).toEqual([fixes.filler("etc", strings.strength.excellent)]);
  });

  it("asks to shorten a bullet past 32 words", () => {
    expect(bulletStrength(padded(33), []).fixes).toEqual([
      fixes.lengthLong(strings.strength.excellent),
    ]);
  });

  it("has no fixes at Excellent", () => {
    expect(bulletStrength(EXCELLENT, []).fixes).toEqual([]);
  });
});

describe("strength meter segments", () => {
  it("fills one segment per tier", () => {
    expect(filledSegments("weak")).toBe(1);
    expect(filledSegments("fair")).toBe(2);
    expect(filledSegments("good")).toBe(3);
    expect(filledSegments("strong")).toBe(4);
    expect(filledSegments("excellent")).toBe(5);
  });
});

describe("verb list", () => {
  it("includes operational verbs and omits the weak openers", () => {
    expect(new Set(STRONG_VERB_LIST).size).toBe(STRONG_VERB_LIST.length);
    expect(STRONG_VERB_LIST.length).toBeGreaterThanOrEqual(140);
    for (const verb of [
      "led",
      "lead",
      "analysed",
      "analyzed",
      "co-founded",
      "completed",
      "complete",
      "coordinated",
      "resolved",
      "processed",
      "process",
      "reconciled",
      "reconcile",
      "maintained",
      "supported",
      "prepared",
      "prepare",
      "scheduled",
      "served",
      "added",
      "kept",
      "counted",
      "rebuilt",
      "paired",
      "taught",
      "entered",
      "ran",
      "run",
    ]) {
      expect(STRONG_VERBS.has(verb)).toBe(true);
    }
    for (const weak of ["responsible", "helped", "worked", "assisted", "tasked"]) {
      expect(STRONG_VERBS.has(weak)).toBe(false);
    }
  });
});

describe("known terms", () => {
  it("includes the core tools and has no duplicates", () => {
    expect(new Set(KNOWN_TERMS).size).toBe(KNOWN_TERMS.length);
    expect(KNOWN_TERMS.length).toBeGreaterThanOrEqual(60);
    for (const term of ["sql", "excel", "python", "react", "aws", "wordpress"]) {
      expect(KNOWN_TERMS).toContain(term);
    }
  });
});

/**
 * Eval-fixture bullets plus the seeded library (Avery Lang).
 * A personal resume is not stored here.
 * Tiers were reviewed so a real action verb is not called weak, and no fix
 * tells the writer to invent a number.
 */
const REVIEWED_TIERS: StrengthTier[] = [
  "excellent",
  "excellent",
  "strong",
  "strong",
  "strong",
  "excellent",
  "strong",
  "strong",
  "good",
  "excellent",
  "excellent",
  "excellent",
  "strong",
  "strong",
  "excellent",
  "good",
  "fair",
  "excellent",
  "excellent",
  "strong",
  "strong",
  "excellent",
  "excellent",
  "strong",
  "fair",
  "strong",
  "strong",
  "strong",
  "strong",
  "good",
  "strong",
  "strong",
  "excellent",
  "good",
  "good",
  "excellent",
  "weak",
  "fair",
  "strong",
  "good",
  "weak",
  "excellent",
  "good",
  "good",
];

function reviewedBullets(): { source: string; text: string; skills: string[] }[] {
  const libraryDir = path.resolve(process.cwd(), "evals/fixtures/libraries");
  const files = readdirSync(libraryDir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const bullets = files.flatMap((filename) => {
    const snapshot = LibrarySnapshot.parse(
      JSON.parse(readFileSync(path.join(libraryDir, filename), "utf8")),
    );
    const skills = snapshot.skills.map((skill) => skill.name);
    return snapshot.entries.flatMap((entry) =>
      entry.bullets.map((bullet) => ({
        source: filename,
        text: bullet.text,
        skills,
      })),
    );
  });
  const seedSkills = SEED_LIBRARY.skills.map((skill) => skill.name);
  for (const entry of SEED_LIBRARY.entries) {
    for (const bullet of entry.bullets) {
      bullets.push({ source: "seed", text: bullet.text, skills: seedSkills });
    }
  }
  return bullets;
}

describe("reviewed resume bullets", () => {
  const bullets = reviewedBullets();

  it("covers at least 40 bullets from the eval fixtures and the seeded library", () => {
    expect(bullets.length).toBeGreaterThanOrEqual(40);
    expect(REVIEWED_TIERS).toHaveLength(bullets.length);
  });

  it.each(bullets.map((bullet, index) => ({ ...bullet, index })))(
    "$source #$index stays at the reviewed tier",
    ({ text, skills, index }) => {
      const result = bulletStrength(text, skills);
      expect(result.tier).toBe(REVIEWED_TIERS[index]);
      for (const fix of result.fixes) {
        expect(fix).not.toMatch(/^Add a (number|metric)\b/i);
      }
    },
  );
});
