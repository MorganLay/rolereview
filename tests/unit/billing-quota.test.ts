import { beforeEach, describe, expect, it, vi } from "vitest";

const { count, aggregate } = vi.hoisted(() => ({
  count: vi.fn(),
  aggregate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    aiCall: { count },
    bonusCredit: { aggregate },
  },
}));

import { PLANS } from "@/features/billing/plans";
import {
  checkQuota,
  decideQuota,
  periodBounds,
  selectBonusCredit,
  type BonusCreditCandidate,
} from "@/features/billing/quota";

const NOW = new Date("2026-10-19T15:04:00.000Z");

function credit(
  partial: Partial<BonusCreditCandidate> & Pick<BonusCreditCandidate, "id">,
): BonusCreditCandidate {
  return {
    remaining: 1,
    expiresAt: new Date("2026-11-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...partial,
  };
}

describe("decideQuota", () => {
  const cases: Array<{
    name: string;
    used: number;
    allowance: number;
    bonus: number;
    allowed: boolean;
    useBonus: boolean;
  }> = [
    { name: "under allowance ignores bonus", used: 0, allowance: 3, bonus: 5, allowed: true, useBonus: false },
    { name: "last included use", used: 2, allowance: 3, bonus: 0, allowed: true, useBonus: false },
    { name: "allowance used up", used: 3, allowance: 3, bonus: 0, allowed: false, useBonus: false },
    { name: "allowance used up with bonus", used: 3, allowance: 3, bonus: 1, allowed: true, useBonus: true },
    { name: "over allowance with bonus", used: 9, allowance: 3, bonus: 2, allowed: true, useBonus: true },
    { name: "zero allowance no bonus", used: 0, allowance: 0, bonus: 0, allowed: false, useBonus: false },
    { name: "zero allowance with bonus", used: 0, allowance: 0, bonus: 1, allowed: true, useBonus: true },
  ];

  it.each(cases)("$name", ({ used, allowance, bonus, allowed, useBonus }) => {
    expect(decideQuota({ used, allowance, bonus })).toEqual({ allowed, useBonus });
  });
});

describe("periodBounds", () => {
  it("uses the UTC day for ANALYZE, including the Tokyo date line", () => {
    const bounds = periodBounds("ANALYZE", new Date("2026-05-31T23:30:00.000Z"));
    expect(bounds.start.toISOString()).toBe("2026-05-31T00:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("rolls the ANALYZE day at UTC midnight", () => {
    const before = periodBounds("ANALYZE", new Date("2026-10-19T23:59:59.999Z"));
    const after = periodBounds("ANALYZE", new Date("2026-10-20T00:00:00.000Z"));
    expect(before.end.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(after.start.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  it("uses the UTC calendar month for other kinds", () => {
    const february = periodBounds("TAILOR", new Date("2026-02-28T23:59:59.999Z"));
    expect(february.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(february.end.toISOString()).toBe("2026-03-01T00:00:00.000Z");

    const yearEnd = periodBounds("IMPORT", new Date("2026-12-31T23:00:00.000Z"));
    expect(yearEnd.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(yearEnd.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("keeps 29 February inside February", () => {
    const day = periodBounds("ANALYZE", new Date("2024-02-29T12:00:00.000Z"));
    expect(day.start.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(day.end.toISOString()).toBe("2024-03-01T00:00:00.000Z");
    const month = periodBounds("COVER_LETTER", new Date("2024-02-29T12:00:00.000Z"));
    expect(month.start.toISOString()).toBe("2024-02-01T00:00:00.000Z");
    expect(month.end.toISOString()).toBe("2024-03-01T00:00:00.000Z");
  });
});

describe("plan limits", () => {
  it("matches the pricing table and shares periods across plans", () => {
    expect(PLANS.FREE.limits.TAILOR.allowance).toBe(3);
    expect(PLANS.PRO.limits.TAILOR.allowance).toBe(80);
    expect(PLANS.FREE.limits.COVER_LETTER.allowance).toBe(1);
    expect(PLANS.PRO.limits.COVER_LETTER.allowance).toBe(60);
    expect(PLANS.FREE.limits.IMPORT.allowance).toBe(2);
    expect(PLANS.PRO.limits.IMPORT.allowance).toBe(20);
    expect(PLANS.FREE.limits.ANALYZE.allowance).toBe(10);
    expect(PLANS.PRO.limits.ANALYZE.allowance).toBe(60);
    expect(PLANS.FREE.limits.PREP_KIT.allowance).toBe(1);
    expect(PLANS.PRO.limits.PREP_KIT.allowance).toBe(30);
    expect(PLANS.FREE.limits.BULLET_COACH.allowance).toBe(10);
    expect(PLANS.PRO.limits.BULLET_COACH.allowance).toBe(300);
    expect(PLANS.PRO.price.monthlyUsd).toBe(19);
    expect(PLANS.PRO.price.quarterlyUsd).toBe(45);

    for (const kind of Object.keys(PLANS.FREE.limits) as Array<
      keyof typeof PLANS.FREE.limits
    >) {
      expect(PLANS.FREE.limits[kind].period).toBe(PLANS.PRO.limits[kind].period);
    }
    expect(PLANS.FREE.limits.ANALYZE.period).toBe("day");
    expect(PLANS.FREE.limits.TAILOR.period).toBe("month");
  });
});

describe("selectBonusCredit", () => {
  it("returns null when nothing is usable", () => {
    expect(selectBonusCredit([], NOW)).toBeNull();
    expect(
      selectBonusCredit(
        [
          credit({ id: "empty", remaining: 0 }),
          credit({ id: "expired", expiresAt: new Date("2026-10-01T00:00:00.000Z") }),
          credit({ id: "now", expiresAt: NOW }),
        ],
        NOW,
      ),
    ).toBeNull();
  });

  it("picks the soonest expiry, then the oldest row, and leaves unexpiring credits last", () => {
    const picked = selectBonusCredit(
      [
        credit({
          id: "never",
          expiresAt: null,
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
        }),
        credit({
          id: "later",
          expiresAt: new Date("2026-12-01T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        credit({
          id: "soon-new",
          expiresAt: new Date("2026-10-20T00:00:00.000Z"),
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
        }),
        credit({
          id: "soon-old",
          expiresAt: new Date("2026-10-20T00:00:00.000Z"),
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        }),
      ],
      NOW,
    );
    expect(picked?.id).toBe("soon-old");
  });

  it("uses the oldest unexpiring credit when nothing expires", () => {
    const picked = selectBonusCredit(
      [
        credit({
          id: "newer",
          expiresAt: null,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
        }),
        credit({
          id: "older",
          expiresAt: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ],
      NOW,
    );
    expect(picked?.id).toBe("older");
  });
});

describe("checkQuota", () => {
  beforeEach(() => {
    count.mockReset();
    aggregate.mockReset();
    aggregate.mockResolvedValue({ _sum: { remaining: 0 } });
  });

  it("counts successful plan uses inside the UTC day for ANALYZE", async () => {
    count.mockResolvedValue(10);
    const decision = await checkQuota({ id: "user-1", plan: "FREE" }, "ANALYZE", NOW);
    expect(decision).toEqual({ allowed: false, useBonus: false });
    expect(count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        kind: "ANALYZE",
        success: true,
        usedBonusCredit: false,
        createdAt: {
          gte: new Date("2026-10-19T00:00:00.000Z"),
          lt: new Date("2026-10-20T00:00:00.000Z"),
        },
      },
    });
  });

  it("uses a bonus credit after the monthly allowance", async () => {
    count.mockResolvedValue(3);
    aggregate.mockResolvedValue({ _sum: { remaining: 2 } });
    const decision = await checkQuota({ id: "user-1", plan: "FREE" }, "TAILOR", NOW);
    expect(decision).toEqual({ allowed: true, useBonus: true });
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        createdAt: {
          gte: new Date("2026-10-01T00:00:00.000Z"),
          lt: new Date("2026-11-01T00:00:00.000Z"),
        },
      }),
    });
    expect(aggregate).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        kind: "TAILOR",
        remaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
      },
      _sum: { remaining: true },
    });
  });

  it("treats a missing bonus sum as zero", async () => {
    count.mockResolvedValue(0);
    aggregate.mockResolvedValue({ _sum: { remaining: null } });
    const decision = await checkQuota({ id: "user-1", plan: "PRO" }, "IMPORT", NOW);
    expect(decision).toEqual({ allowed: true, useBonus: false });
  });
});
