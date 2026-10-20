import { describe, expect, it } from "vitest";

import { can } from "@/features/billing/entitlements";
import { FEATURES } from "@/features/billing/plans";

describe("can", () => {
  it("denies every pro feature on Free and allows them on Pro", () => {
    for (const feature of FEATURES) {
      expect(can({ plan: "FREE" }, feature)).toBe(false);
      expect(can({ plan: "PRO" }, feature)).toBe(true);
    }
  });
});
