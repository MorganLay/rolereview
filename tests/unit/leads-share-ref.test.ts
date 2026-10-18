import { describe, expect, it } from "vitest";

import { shareRefFromLeadId } from "@/features/growth/leads/share-ref";

describe("shareRefFromLeadId", () => {
  it("builds a stable short ref from a UUID", () => {
    expect(
      shareRefFromLeadId("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    ).toBe("waitlist-a1b2c3d4");
  });
});
