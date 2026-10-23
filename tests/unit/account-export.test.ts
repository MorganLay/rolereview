import { describe, expect, it } from "vitest";

import {
  ACCOUNT_EXPORT_COLLECTIONS,
  buildAccountExport,
  EXPORT_FILENAME,
  type AccountExportCollections,
} from "@/features/account/export";

const EXPORTED_AT = new Date("2026-10-23T08:15:00.000Z");

function emptyCollections(
  patch: Partial<AccountExportCollections> = {},
): AccountExportCollections {
  const collections = {
    referredBy: null,
  } as AccountExportCollections;
  for (const key of ACCOUNT_EXPORT_COLLECTIONS) {
    collections[key] = [];
  }
  return { ...collections, ...patch };
}

describe("buildAccountExport", () => {
  it("names the download and keeps an empty account", () => {
    expect(EXPORT_FILENAME).toBe("rolerefine-export.json");
    const body = buildAccountExport({
      exportedAt: EXPORTED_AT,
      user: { id: "user-1", email: "a@example.com", createdAt: EXPORTED_AT },
      collections: emptyCollections(),
    });
    expect(body.exportedAt).toBe("2026-10-23T08:15:00.000Z");
    expect(body.user).toMatchObject({ email: "a@example.com" });
    expect(body.referredBy).toBeNull();
    expect(body.entries).toEqual([]);
    expect(body.testimonials).toEqual([]);
    expect(body).not.toHaveProperty("leads");
    expect(body).not.toHaveProperty("emailLogs");
  });

  it("keeps posting text and converts nested dates and bigints", () => {
    const body = buildAccountExport({
      exportedAt: EXPORTED_AT,
      user: { id: "user-1" },
      collections: emptyCollections({
        jobs: [
          {
            id: "job-1",
            rawText: "Library technician, $50,000",
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
            cost: BigInt(15),
          },
        ],
        referredBy: { id: "ref-1", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      }),
    });
    expect(body.jobs).toEqual([
      {
        id: "job-1",
        rawText: "Library technician, $50,000",
        createdAt: "2026-01-02T00:00:00.000Z",
        cost: "15",
      },
    ]);
    expect(body.referredBy).toEqual({
      id: "ref-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
