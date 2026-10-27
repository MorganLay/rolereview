import { describe, expect, it } from "vitest";

import type { ResumeContent } from "@/features/tailor/schemas";
import {
  layoutFontSize,
  layoutFromDensity,
  minimumFontSize,
  PDF_DENSITIES,
} from "@/lib/pdf/document";
import { decodeFitSuggestions, encodeFitSuggestions } from "@/lib/pdf/fit-header";
import type { ResumePdfModel } from "@/lib/pdf/model";
import { linesAfterFirstPage } from "@/lib/pdf/overflow";
import { pdfPageCount } from "@/lib/pdf/pages";
import {
  fitResumePdf,
  ONE_PAGE_FIT_STEPS,
  renderFitLayout,
} from "@/lib/pdf/render";
import { suggestBulletsToTurnOff } from "@/lib/pdf/suggest";
import { RESUME_TEMPLATES } from "@/lib/pdf/template";

import { contentBullet, resumeContent } from "./tailor-fixture";

const BULLET =
  "Maintained 12 weekly reports for a 20-person team and wrote the handoff notes that cut the review from an hour to twenty minutes.";

describe("one-page fit ladder", () => {
  it("maps compact spacing, then one contact line, then the template minimum", () => {
    expect(ONE_PAGE_FIT_STEPS.map((step) => [step.step, step.groupLinks])).toEqual([
      ["compact", false],
      ["links", true],
      ["minimum", true],
    ]);
    expect(ONE_PAGE_FIT_STEPS[0]).toMatchObject({ spacing: "tight", type: "regular" });
    expect(ONE_PAGE_FIT_STEPS[1]).toMatchObject({ spacing: "tight", type: "regular" });
    expect(ONE_PAGE_FIT_STEPS[2]).toMatchObject({ spacing: "tighter", type: "tighter" });

    for (const template of RESUME_TEMPLATES) {
      const minimum = minimumFontSize(template);
      const regular = layoutFontSize(template, { spacing: "regular", type: "regular", groupLinks: false });
      expect(layoutFontSize(template, ONE_PAGE_FIT_STEPS[0]!)).toBe(regular);
      expect(layoutFontSize(template, ONE_PAGE_FIT_STEPS[1]!)).toBe(regular);
      expect(layoutFontSize(template, ONE_PAGE_FIT_STEPS[2]!)).toBe(minimum);
      expect(regular).toBeGreaterThan(minimum);
      for (const density of PDF_DENSITIES) {
        expect(layoutFontSize(template, layoutFromDensity(density))).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it("keeps the first step that fits, and the page count is pdfPageCount", async () => {
    const model = resumeWithBullets(24);
    const fit = await fitResumePdf(model, "classic", { pages: 1 });
    const steps = [
      { step: "regular" as const, spacing: "regular" as const, type: "regular" as const, groupLinks: false },
      ...ONE_PAGE_FIT_STEPS,
    ];
    let expected: (typeof steps)[number]["step"] = "minimum";
    for (const step of steps) {
      const pdf = await renderFitLayout(model, "classic", step);
      if (pdfPageCount(pdf) <= 1) {
        expected = step.step;
        break;
      }
    }
    expect(fit.step).toBe(expected);
    expect(fit.pageCount).toBe(pdfPageCount(fit.pdf));
    if (fit.pageCount > 1) {
      expect(fit.overByLines).toBeGreaterThan(0);
    } else {
      expect(fit.overByLines).toBe(0);
    }
  }, 30000);

  it("returns a positive line count and a suggestion when tightening still overflows", async () => {
    const model = resumeWithBullets(90);
    const fit = await fitResumePdf(model, "classic", { pages: 1 });
    const suggestions = suggestBulletsToTurnOff(overflowContent(), [
      { evidenceRefs: ["E1.B1"] },
    ]);

    expect(fit.pageCount).toBeGreaterThan(1);
    expect(fit.pageCount).toBe(pdfPageCount(fit.pdf));
    expect(fit.step).toBe("minimum");
    expect(fit.overByLines).toBeGreaterThan(0);
    expect(linesAfterFirstPage(fit.pdf)).toBe(fit.overByLines);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(suggestions.every((item) => item.text.length > 0)).toBe(true);
  }, 30000);

  it("does not tighten or report overflow when the target is two pages", async () => {
    const model = resumeWithBullets(90);
    const fit = await fitResumePdf(model, "classic", { pages: 2 });
    expect(fit.step).toBe("regular");
    expect(fit.pageCount).toBeGreaterThan(1);
    expect(fit.pageCount).toBe(pdfPageCount(fit.pdf));
    expect(fit.overByLines).toBe(0);
  }, 20000);
});

describe("suggestBulletsToTurnOff", () => {
  it("suggests included bullets that no evidenced requirement cites", () => {
    const content = resumeContent({
      entries: [
        {
          ref: "E1",
          kind: "EXPERIENCE",
          included: true,
          bullets: [
            contentBullet({ id: "cited", text: "Cited line.", sourceRefs: ["E1.B1"] }),
            contentBullet({ id: "free", text: "Unused line.", sourceRefs: ["E1.B2"] }),
            contentBullet({
              id: "off",
              text: "Hidden.",
              sourceRefs: ["E1.B3"],
              included: false,
            }),
          ],
        },
      ],
    });

    expect(
      suggestBulletsToTurnOff(content, [
        { evidenceRefs: ["E1.B1"] },
        { evidenceRefs: ["E1.B3"] },
      ]),
    ).toEqual([{ id: "free", text: "Unused line." }]);
  });

  it("uses the latest included bullets when every one is cited", () => {
    const content = fourExperienceBullets();
    const suggestions = suggestBulletsToTurnOff(content, [
      { evidenceRefs: ["E1.B1", "E1.B2", "E1.B3", "E1.B4"] },
    ]);
    expect(suggestions.map((item) => item.id)).toEqual(["b2", "b3", "b4"]);
    expect(suggestions.map((item) => item.text)).toEqual([
      "Second line.",
      "Third line.",
      "Fourth line.",
    ]);
  });

  it("keeps only the latest uncited bullets, in document order", () => {
    const content = resumeContent({
      entries: [
        {
          ref: "E2",
          kind: "PROJECT",
          included: true,
          bullets: [
            contentBullet({ id: "late", text: "Project line.", sourceRefs: ["E2.B1"] }),
          ],
        },
        ...fourExperienceBullets().entries,
      ],
    });
    const suggestions = suggestBulletsToTurnOff(content, [
      { evidenceRefs: ["E1.B1", "E1.B2"] },
    ]);
    expect(suggestions.map((item) => item.id)).toEqual(["b3", "b4", "late"]);
  });

  it("does not treat an entry citation as citing every bullet", () => {
    const content = fourExperienceBullets();
    const suggestions = suggestBulletsToTurnOff(content, [{ evidenceRefs: ["E1"] }]);
    expect(suggestions.map((item) => item.id)).toEqual(["b2", "b3", "b4"]);
  });

  it("counts a skill-only requirement as evidenced without inventing bullet text", () => {
    const content = resumeContent({
      entries: [
        {
          ref: "E1",
          kind: "EXPERIENCE",
          included: true,
          bullets: [
            contentBullet({ id: "cited", text: "Kept\nline.", sourceRefs: ["E1.B1"] }),
            contentBullet({ id: "free", text: "Other line.", sourceRefs: ["E1.B2"] }),
          ],
        },
      ],
      skills: [{ category: "Languages", names: ["Python"] }],
    });
    expect(
      suggestBulletsToTurnOff(
        content,
        [{ evidenceRefs: ["S1", "E1.B1"] }],
        [{ ref: "S1", name: "Python" }],
      ),
    ).toEqual([{ id: "free", text: "Other line." }]);
    expect(
      suggestBulletsToTurnOff(content, [{ evidenceRefs: ["E1.B9"] }], [{ ref: "S1", name: "Python" }]),
    ).toEqual([
      { id: "cited", text: "Kept line." },
      { id: "free", text: "Other line." },
    ]);
  });

  it("returns nothing when no bullet is included", () => {
    expect(
      suggestBulletsToTurnOff(
        resumeContent({
          entries: [
            {
              ref: "E1",
              kind: "EXPERIENCE",
              included: false,
              bullets: [contentBullet({ id: "off", text: "Shelved.", sourceRefs: ["E1.B1"] })],
            },
          ],
        }),
        [],
      ),
    ).toEqual([]);
  });
});

describe("fit suggestion header", () => {
  it("round-trips the bullet text", () => {
    const items = [{ id: "b1", text: "José's line — kept." }];
    expect(decodeFitSuggestions(encodeFitSuggestions(items))).toEqual(items);
    expect(decodeFitSuggestions(null)).toEqual([]);
    expect(decodeFitSuggestions("@@@")).toEqual([]);
  });
});

function resumeWithBullets(count: number): ResumePdfModel {
  return {
    name: "Morgan Example",
    headline: "Data & reporting analyst",
    contact: "Ottawa, ON · morgan@example.com · 613-555-0100",
    links: [
      "Portfolio: https://example.com/portfolio",
      "LinkedIn: https://example.com/in/morgan",
      "GitHub: https://example.com/morgan",
    ],
    summary: "Analyst with reporting experience across public-sector teams.",
    sections: [
      {
        heading: "Experience",
        entries: [
          {
            title: "Junior Program Officer",
            meta: "Canada Revenue Agency · Ottawa, ON · Nov 2023 – Present",
            url: "https://example.com/role",
            bullets: Array.from({ length: count }, () => BULLET),
          },
        ],
      },
    ],
    skills: ["Languages: Python, SQL"],
  };
}

function overflowContent(): ResumeContent {
  return resumeContent({
    entries: [
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [
          contentBullet({ id: "cited", text: "Cited line.", sourceRefs: ["E1.B1"] }),
          contentBullet({ id: "free", text: "Unused line.", sourceRefs: ["E1.B2"] }),
        ],
      },
    ],
  });
}

function fourExperienceBullets(): ResumeContent {
  return resumeContent({
    entries: [
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [
          contentBullet({ id: "b1", text: "First line.", sourceRefs: ["E1.B1"] }),
          contentBullet({ id: "b2", text: "Second line.", sourceRefs: ["E1.B2"] }),
          contentBullet({ id: "b3", text: "Third line.", sourceRefs: ["E1.B3"] }),
          contentBullet({ id: "b4", text: "Fourth line.", sourceRefs: ["E1.B4"] }),
        ],
      },
    ],
  });
}
