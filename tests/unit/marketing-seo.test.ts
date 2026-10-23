import { describe, expect, it } from "vitest";

import {
  formatChangelogDate,
  parseChangelogDate,
  sortChangelog,
} from "@/features/marketing/changelog";
import {
  PUBLIC_SITEMAP_PATHS,
  ROBOTS_DISALLOW,
  absolutePublicUrl,
  robotsDocument,
  sitemapEntries,
} from "@/features/marketing/seo";

describe("sitemapEntries", () => {
  it("lists only public marketing paths, with a stable lastmod", () => {
    const entries = sitemapEntries("https://www.rolerefine.ca/", "2026-10-22");
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://www.rolerefine.ca",
      "https://www.rolerefine.ca/pricing",
      "https://www.rolerefine.ca/demo",
      "https://www.rolerefine.ca/about",
      "https://www.rolerefine.ca/changelog",
      "https://www.rolerefine.ca/waitlist",
      "https://www.rolerefine.ca/tools/ats-keyword-checker",
      "https://www.rolerefine.ca/tools/bullet-strength",
    ]);
    expect(entries.every((entry) => entry.lastModified === "2026-10-22")).toBe(
      true,
    );
    expect(entries[0]).toMatchObject({
      changeFrequency: "weekly",
      priority: 1,
    });
    const paths: readonly string[] = PUBLIC_SITEMAP_PATHS;
    expect(paths).not.toContain("/privacy");
    expect(paths).not.toContain("/sign-in");
  });

  it("does not double a slash when the origin has no trailing slash", () => {
    expect(absolutePublicUrl("http://localhost:3000", "/about")).toBe(
      "http://localhost:3000/about",
    );
  });
});

describe("robotsDocument", () => {
  it("points at the sitemap and keeps app routes out", () => {
    const robots = robotsDocument("https://www.rolerefine.ca");
    expect(robots.sitemap).toBe("https://www.rolerefine.ca/sitemap.xml");
    expect(robots.rules.allow).toBe("/");
    expect(robots.rules.disallow).toEqual([...ROBOTS_DISALLOW]);
    expect(robots.rules.disallow).toContain("/jobs");
    const disallowed: readonly string[] = robots.rules.disallow;
    expect(disallowed).not.toContain("/pricing");
  });
});

describe("formatChangelogDate", () => {
  it("formats a real UTC day and leaves invalid input unchanged", () => {
    expect(formatChangelogDate("2026-10-22")).toBe("October 22, 2026");
    expect(parseChangelogDate("2026-10-22")?.toISOString()).toBe(
      "2026-10-22T00:00:00.000Z",
    );
    expect(formatChangelogDate("")).toBe("");
    expect(formatChangelogDate("2026-13-01")).toBe("2026-13-01");
    expect(formatChangelogDate("2026-02-31")).toBe("2026-02-31");
    expect(formatChangelogDate("not-a-date")).toBe("not-a-date");
  });
});

describe("sortChangelog", () => {
  it("puts the newest date first and breaks same-day ties by title", () => {
    expect(sortChangelog([])).toEqual([]);
    expect(
      sortChangelog([
        { title: "Beta", date: "2026-10-01" },
        { title: "Alpha", date: "2026-10-22" },
        { title: "Gamma", date: "2026-10-22" },
      ]),
    ).toEqual([
      { title: "Alpha", date: "2026-10-22" },
      { title: "Gamma", date: "2026-10-22" },
      { title: "Beta", date: "2026-10-01" },
    ]);
  });
});
