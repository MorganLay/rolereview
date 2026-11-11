import { describe, expect, it } from "vitest";

import { privacyCopy } from "@/copy/privacy";

function flatten(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).join("\n");
  if (value && typeof value === "object") {
    return Object.values(value).map(flatten).join("\n");
  }
  return "";
}

describe("privacy copy", () => {
  const text = flatten(privacyCopy);

  it("names the sections a reader needs", () => {
    expect(privacyCopy.sections.map((section) => section.id)).toEqual([
      "who",
      "collect",
      "use",
      "ai",
      "hosting",
      "providers",
      "cookies",
      "retention",
      "rights",
      "safeguards",
      "email",
      "changes",
    ]);
    expect(privacyCopy.updated).toBe("Updated November 11, 2026");
  });

  it("keeps the verified hosting split and leaves out an unpublished mailbox", () => {
    expect(text).toContain("ca-central-1");
    expect(text).toContain("Washington, D.C.");
    expect(text).toContain("Anthropic");
    expect(text).toContain("There is no public privacy mailbox yet.");
    expect(text).toContain("does not describe the product as Canadian-only");
    expect(text).toContain("does not describe end-to-end encryption");
    expect(text).not.toMatch(/privacy@/i);
    expect(text).not.toMatch(/fully Canadian-hosted|PIPEDA compliant|we value your privacy/i);
  });
});
