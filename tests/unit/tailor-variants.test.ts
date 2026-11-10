import { describe, expect, it } from "vitest";

import { preferSavedWording, variantPrompt } from "@/features/tailor/variants";

import { librarySnapshot, tailorOutput } from "./tailor-fixture";

describe("preferSavedWording", () => {
  it("keeps the library bullet when the model calls a rewrite canonical", () => {
    const snapshot = librarySnapshot();
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = "A synonym that adds nothing.";
    const prepared = preferSavedWording(
      {
        ...output,
        entries: output.entries.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                bullets: entry.bullets.map((item, bulletIndex) =>
                  bulletIndex === 0
                    ? { ...item, text: "A synonym that adds nothing.", choice: "canonical", why: "Same facts." }
                    : item,
                ),
              }
            : entry,
        ),
      },
      [],
      snapshot,
    );
    expect(prepared.output.entries[0]?.bullets[0]?.text).toBe(
      "Built and maintained 14 reports for a 20-person team.",
    );
  });

  it("uses an approved variant only when it belongs to the cited bullet", () => {
    const snapshot = librarySnapshot();
    const output = tailorOutput();
    const prepared = preferSavedWording(
      {
        ...output,
        entries: output.entries.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                bullets: entry.bullets.map((item, bulletIndex) =>
                  bulletIndex === 0
                    ? {
                        ...item,
                        text: "Invented SQL infrastructure.",
                        choice: "variant",
                        variantId: "saved-1",
                        why: "Selected this version because it emphasizes SQL reporting.",
                      }
                    : item,
                ),
              }
            : entry,
        ),
      },
      [
        {
          id: "saved-1",
          bulletId: "b1",
          jobId: null,
          text: "Maintained 14 SQL reports for a 20-person team.",
          reason: "Emphasizes SQL reporting.",
        },
      ],
      snapshot,
    );
    expect(prepared.output.entries[0]?.bullets[0]?.text).toBe(
      "Maintained 14 SQL reports for a 20-person team.",
    );
    expect(prepared.why.get("E1.B1")?.why).toContain("SQL reporting");
    expect(variantPrompt(snapshot, [])).toBe("none");
  });

  it("keeps a rewrite explanation when the line is not a saved variant", () => {
    const snapshot = librarySnapshot();
    const output = tailorOutput();
    const prepared = preferSavedWording(
      {
        ...output,
        entries: output.entries.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                bullets: entry.bullets.map((item, bulletIndex) =>
                  bulletIndex === 0
                    ? {
                        ...item,
                        text: "Maintained 14 reports for a 20-person processing team.",
                        choice: "rewrite",
                        variantId: null,
                        what: "Names the team the source already gives.",
                        why: "The posting asks for reporting that a team uses.",
                        requirementIds: ["r1"],
                      }
                    : item,
                ),
              }
            : entry,
        ),
      },
      [],
      snapshot,
    );
    expect(prepared.output.entries[0]?.bullets[0]?.text).toContain("processing team");
    expect(prepared.why.get("E1.B1")).toMatchObject({
      what: "Names the team the source already gives.",
      why: "The posting asks for reporting that a team uses.",
      requirementIds: ["r1"],
    });
  });
});
