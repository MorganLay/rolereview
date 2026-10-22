import { describe, expect, it } from "vitest";

import { letterSourceChips } from "@/features/letters/sources";

import { librarySnapshot } from "./tailor-fixture";

describe("letterSourceChips", () => {
  it("resolves library refs, the posting, and the why note", () => {
    const chips = letterSourceChips(
      ["E1.B1", "POSTING", "WHY", "S1", "E1", "missing", "E1.B1"],
      librarySnapshot(),
    );

    expect(chips.map((chip) => chip.kind)).toEqual([
      "library",
      "posting",
      "why",
      "library",
      "library",
    ]);
    expect(chips[0]?.text).toContain("14 reports");
    expect(chips[1]?.title).toBe("from the posting");
    expect(chips[2]?.title).toBe("from your notes");
    expect(chips[3]?.title).toBe("Python");
    expect(chips[4]?.title).toBe("Junior Program Officer");
  });
});
