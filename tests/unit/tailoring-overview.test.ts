import { describe, expect, it } from "vitest";

import type { Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { tailoringOverview } from "@/features/tailor/overview";
import type { ContentBullet, ResumeContent } from "@/features/tailor/schemas";

const REQUIREMENT: Requirement = {
  id: "r-react",
  text: "Experience building production React applications",
  kind: "experience",
  importance: "must",
};

function bullet(overrides: Partial<ContentBullet> = {}): ContentBullet {
  return {
    id: "b1",
    text: "Shipped a booking site in React.",
    included: true,
    sourceRefs: ["E1.B1"],
    reverted: false,
    edited: false,
    originalText: "Shipped a booking site in React.",
    suggestion: null,
    suggestionNote: null,
    changeWhat: null,
    requirementIds: [],
    ...overrides,
  };
}

function snapshot(summary = "Library summary."): LibrarySnapshot {
  return {
    takenAt: "2026-11-09T00:00:00.000Z",
    profile: {
      fullName: "Morgan Example",
      headline: null,
      email: "morgan@example.com",
      phone: null,
      location: null,
      links: [],
      summary,
    },
    entries: [
      {
        ref: "E1",
        id: "e1",
        kind: "EXPERIENCE",
        title: "Full-Stack Developer Intern",
        organization: "DEF Robotics",
        location: null,
        startDate: "2020-11",
        endDate: "2021-08",
        isCurrent: false,
        url: null,
        bullets: [
          { ref: "E1.B1", id: "lb1", text: "Shipped a booking site in React." },
          { ref: "E1.B2", id: "lb2", text: "Left this bullet off." },
        ],
      },
      {
        ref: "E2",
        id: "e2",
        kind: "PROJECT",
        title: "Booking site",
        organization: null,
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [{ ref: "E2.B1", id: "lb3", text: "Built the booking flow." }],
      },
      {
        ref: "E3",
        id: "e3",
        kind: "EXPERIENCE",
        title: "Shelf intern",
        organization: "City Library",
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [{ ref: "E3.B1", id: "lb4", text: "Shelved returns." }],
      },
    ],
    skills: [],
  };
}

function content(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    schemaVersion: 1,
    summary: { text: "Library summary.", included: true },
    entries: [
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [bullet(), bullet({ id: "b2", text: "Left this bullet off.", included: false, sourceRefs: ["E1.B2"], originalText: "Left this bullet off." })],
      },
      {
        ref: "E2",
        kind: "PROJECT",
        included: true,
        bullets: [
          bullet({
            id: "b3",
            text: "Built the booking flow.",
            sourceRefs: ["E2.B1"],
            originalText: "Built the booking flow.",
          }),
        ],
      },
      {
        ref: "E3",
        kind: "EXPERIENCE",
        included: false,
        bullets: [
          bullet({
            id: "b4",
            text: "Shelved returns.",
            included: false,
            sourceRefs: ["E3.B1"],
            originalText: "Shelved returns.",
          }),
        ],
      },
    ],
    skills: [],
    ...overrides,
  };
}

describe("tailoring overview", () => {
  it("leads with the summary and keeps at most four metrics, preferring omissions over retained lines", () => {
    const overview = tailoringOverview({
      jobTitle: "Fullstack Software Engineer (Remote)",
      content: content({
        summary: { text: "Rewritten summary for the role.", included: true },
      }),
      snapshot: snapshot(),
      requirements: [REQUIREMENT],
    });

    expect(overview.strategy).toBe(
      "The summary was rewritten for Fullstack Software Engineer (Remote). Full-Stack Developer Intern at DEF Robotics leads the experience, and Booking site is included.",
    );
    expect(overview.metrics.map((metric) => metric.id)).toEqual([
      "summary",
      "projects",
      "retained",
      "omitted",
    ]);
    expect(JSON.stringify(overview)).not.toMatch(/need review|not demonstrated|%|match score/i);
    expect(overview.decisions.find((item) => item.id === "omitted")?.body).toContain(
      "Shelf intern at City Library",
    );
    expect(overview.decisions.find((item) => item.id === "omitted")?.links[0]?.elementId).toBe(
      "resume-entry-E3",
    );
  });

  it("caps five facts at four and drops the retained count", () => {
    const page = content({
      summary: { text: "A new summary.", included: true },
      entries: [
        {
          ref: "E1",
          kind: "EXPERIENCE",
          included: true,
          bullets: [
            bullet({
              text: "Shipped a production booking site in React.",
              suggestion: "Shipped a production booking site in React.",
              changeWhat: "Names the production booking site.",
              requirementIds: ["r-react"],
            }),
            bullet({ id: "kept", text: "Left this bullet off.", included: true, sourceRefs: ["E1.B2"], originalText: "Left this bullet off." }),
          ],
        },
        {
          ref: "E2",
          kind: "PROJECT",
          included: true,
          bullets: [
            bullet({
              id: "b3",
              text: "Built the booking flow.",
              sourceRefs: ["E2.B1"],
              originalText: "Built the booking flow.",
            }),
          ],
        },
        {
          ref: "E3",
          kind: "EXPERIENCE",
          included: false,
          bullets: [],
        },
      ],
    });
    const overview = tailoringOverview({
      jobTitle: "Fullstack Software Engineer (Remote)",
      content: page,
      snapshot: snapshot(),
      requirements: [REQUIREMENT],
    });
    expect(overview.metrics.map((metric) => metric.id)).toEqual([
      "summary",
      "rewritten",
      "projects",
      "omitted",
    ]);
    const rewrites = overview.decisions.find((item) => item.id === "rewrites");
    expect(rewrites?.body).toContain("Names the production booking site.");
    expect(rewrites?.body).toContain("Experience building production React applications");
    expect(rewrites?.links[0]?.elementId).toBe("resume-bullet-b1");
  });

  it("does not invent a reason from a vague note or an unknown requirement id", () => {
    const page = content({
      entries: [
        {
          ref: "E1",
          kind: "EXPERIENCE",
          included: true,
          bullets: [
            bullet({
              text: "Shipped the booking site with React.",
              suggestion: "Shipped the booking site with React.",
              changeWhat: "Rephrased to emphasize the facts in this bullet that match the role.",
              suggestionNote: "Better aligned with the posting.",
              requirementIds: ["missing"],
            }),
          ],
        },
        {
          ref: "E2",
          kind: "PROJECT",
          included: false,
          bullets: [],
        },
        {
          ref: "E3",
          kind: "EXPERIENCE",
          included: false,
          bullets: [],
        },
      ],
    });
    const overview = tailoringOverview({
      jobTitle: "Fullstack Software Engineer (Remote)",
      content: page,
      snapshot: snapshot(),
      requirements: [REQUIREMENT],
    });
    const text = JSON.stringify(overview);
    expect(text).not.toContain("Rephrased to emphasize");
    expect(text).not.toContain("Better aligned");
    expect(text).not.toContain("missing");
    expect(text).toContain("Rewritten from the library bullet.");
  });

  it("stays quiet when nothing was rewritten or left off", () => {
    const page = content({
      entries: [
        {
          ref: "E1",
          kind: "EXPERIENCE",
          included: true,
          bullets: [bullet()],
        },
      ],
    });
    const overview = tailoringOverview({
      jobTitle: "",
      content: page,
      snapshot: snapshot(),
      requirements: [],
    });
    expect(overview.strategy).toBe(
      "Your wording was kept for this role. Full-Stack Developer Intern at DEF Robotics leads the experience.",
    );
    expect(overview.metrics.map((metric) => metric.label)).toEqual(["1 kept as written"]);
    expect(overview.decisions.map((item) => item.id)).toEqual(["experience"]);
  });
});
