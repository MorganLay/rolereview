import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import { categoryChoices } from "@/features/import/skill-categories";

const suggestions = strings.library.skills.suggestions;

describe("categoryChoices", () => {
  it("keeps extracted categories first, with their spelling", () => {
    expect(categoryChoices(["Practices", "tools"], suggestions)).toEqual([
      "Practices",
      "tools",
      "Languages",
      "Frameworks",
      "Cloud",
      "Data",
      "Soft skills",
    ]);
  });

  it("drops blanks and case-insensitive repeats without changing the inputs", () => {
    const categories = ["  Frameworks ", "", "frameworks", "   "];
    const extra = ["Tools", "tools", "Design"];
    const snapshot = [...categories];
    const extraSnapshot = [...extra];

    expect(categoryChoices(categories, extra)).toEqual(["Frameworks", "Tools", "Design"]);
    expect(categories).toEqual(snapshot);
    expect(extra).toEqual(extraSnapshot);
  });

  it("returns the usual names when nothing was extracted", () => {
    expect(categoryChoices(["", "  "], suggestions)).toEqual([...suggestions]);
  });
});
