import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import { applyBulletAction } from "@/features/library/bullet-state";
import {
  BULLET_LIMITS,
  bulletTextSchema,
  createBulletSchema,
  updateBulletSchema,
} from "@/features/library/schemas";
import type { LibraryBullet } from "@/features/library/types";

const errors = strings.library.bullets.errors;

const bulletId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000099";

describe("bulletTextSchema", () => {
  it("trims and accepts 400 characters", () => {
    const text = "a".repeat(BULLET_LIMITS.text);
    expect(bulletTextSchema.parse(`  ${text}  `)).toBe(text);
  });

  it("rejects empty and whitespace-only text", () => {
    for (const value of ["", "   ", "\n\t"]) {
      const parsed = bulletTextSchema.safeParse(value);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe(errors.text);
      }
    }
  });

  it("rejects 401 characters", () => {
    const parsed = bulletTextSchema.safeParse("a".repeat(BULLET_LIMITS.text + 1));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(errors.textLength);
    }
  });

  it("keeps quotes, angle brackets, and SQL-shaped text", () => {
    const text = `Raised NPS 12% — kept "quotes", '<tags>', and '; drop table bullet' as text`;
    expect(bulletTextSchema.parse(text)).toBe(text);
  });
});

describe("bullet action schemas", () => {
  it("strips a client-supplied userId", () => {
    const parsed = updateBulletSchema.parse({
      id: bulletId,
      text: "  Shipped the billing export.  ",
      userId: otherUserId,
    });
    expect(parsed).toEqual({
      id: bulletId,
      text: "Shipped the billing export.",
    });
    expect("userId" in parsed).toBe(false);
  });

  it("rejects a non-uuid entry id and a blank bullet", () => {
    const parsed = createBulletSchema.safeParse({
      entryId: "not-an-id",
      text: "   ",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("applyBulletAction", () => {
  const bullets: LibraryBullet[] = [
    { id: "a", text: "First", sortOrder: 0 },
    { id: "b", text: "Second", sortOrder: 1 },
    { id: "c", text: "Third", sortOrder: 2 },
  ];

  it("updates, appends, and deletes without touching the other rows", () => {
    expect(applyBulletAction(bullets, { type: "update", id: "b", text: "Edited" })).toEqual([
      bullets[0],
      { id: "b", text: "Edited", sortOrder: 1 },
      bullets[2],
    ]);
    expect(
      applyBulletAction(bullets, { type: "create", tempId: "temp", text: "New" }),
    ).toEqual([...bullets, { id: "temp", text: "New", sortOrder: 3 }]);
    expect(applyBulletAction(bullets, { type: "delete", id: "b" }).map((bullet) => bullet.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("swaps neighbours and leaves the list unchanged at the ends", () => {
    expect(
      applyBulletAction(bullets, { type: "reorder", id: "b", direction: "up" }).map(
        (bullet) => bullet.id,
      ),
    ).toEqual(["b", "a", "c"]);
    expect(applyBulletAction(bullets, { type: "reorder", id: "a", direction: "up" })).toEqual(
      bullets,
    );
  });
});
