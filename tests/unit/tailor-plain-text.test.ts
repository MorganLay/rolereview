import { describe, expect, it } from "vitest";

import { resumePlainText } from "@/features/tailor/plainText";

import {
  contentBullet,
  librarySnapshot,
  resumeContent,
} from "./tailor-fixture";

const EN_DASH = "\u2013";
const DOT = "\u00b7";

function sample() {
  return resumeContent({
    summary: { text: "Analyst with reporting experience.", included: true },
    entries: [
      {
        ref: "E2",
        kind: "PROJECT",
        included: true,
        bullets: [
          contentBullet({
            id: "p1",
            text: "Wrote a Python bot\nthat booked rooms.",
          }),
        ],
      },
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [
          contentBullet({
            id: "e1",
            text: "Maintained 14 reports for a 20-person team.",
          }),
          contentBullet({
            id: "e2",
            text: "Left off.",
            included: false,
          }),
        ],
      },
      {
        ref: "E4",
        kind: "EXPERIENCE",
        included: false,
        bullets: [contentBullet({ id: "e4", text: "Shelved returns each morning." })],
      },
      {
        ref: "E3",
        kind: "EDUCATION",
        included: true,
        bullets: [],
      },
    ],
    skills: [
      { category: "Languages", names: ["Python", "SQL"] },
      { category: null, names: ["IBM Cognos"] },
      { category: "   ", names: ["  "] },
    ],
  });
}

describe("resumePlainText", () => {
  it("prints included sections in resume order with contact and dates", () => {
    const text = resumePlainText(sample(), librarySnapshot());

    expect(text).toBe(
      [
        "Morgan Example",
        "Data & reporting analyst",
        `Ottawa, ON ${DOT} morgan@example.com ${DOT} 613-555-0100`,
        "Portfolio: https://example.com",
        "",
        "Summary",
        "Analyst with reporting experience.",
        "",
        "Experience",
        "Junior Program Officer",
        `Canada Revenue Agency ${DOT} Ottawa, ON ${DOT} 2023-11 ${EN_DASH} Present`,
        "- Maintained 14 reports for a 20-person team.",
        "",
        "Projects",
        "Booking bot",
        `2025-03 ${EN_DASH} 2025-04`,
        "- Wrote a Python bot that booked rooms.",
        "",
        "Education",
        "B.CS. Honours",
        `Carleton University ${DOT} Ottawa, ON ${DOT} ${EN_DASH} 2023`,
        "",
        "Skills",
        "Languages: Python, SQL",
        "IBM Cognos",
      ].join("\n"),
    );
  });

  it("leaves out excluded text, the library summary, entry URLs, and branding", () => {
    const text = resumePlainText(sample(), librarySnapshot());

    expect(text).not.toContain("Left off.");
    expect(text).not.toContain("Shelved");
    expect(text).not.toContain("Library summary");
    expect(text).not.toContain("https://example.com/role");
    expect(text).not.toContain("RoleRefine");
  });

  it("omits a blank summary, a missing phone, and an empty resume", () => {
    const content = sample();
    content.summary = { text: "  \n", included: true };
    const snapshot = librarySnapshot();
    snapshot.profile.phone = null;

    const text = resumePlainText(content, snapshot);

    expect(text.startsWith("Morgan Example")).toBe(true);
    expect(text).not.toContain("Summary");
    expect(text).not.toContain("613-555-0100");
    expect(text).toContain(
      `Ottawa, ON ${DOT} morgan@example.com`,
    );

    const empty = resumePlainText(
      resumeContent({ summary: { text: "", included: false } }),
      { ...snapshot, profile: { ...snapshot.profile, fullName: null, headline: null, email: "", phone: null, location: null, links: [] } },
    );
    expect(empty).toBe("");
  });

  it("prints Present for a current role with no start, and a label-less link", () => {
    const content = sample();
    const snapshot = librarySnapshot();
    const experience = snapshot.entries[0];
    if (!experience) throw new Error("missing experience");
    experience.startDate = null;
    experience.isCurrent = true;
    snapshot.profile.links = [{ label: "   ", url: "https://example.com/bare" }];

    const text = resumePlainText(content, snapshot);

    expect(text).toContain(`Canada Revenue Agency ${DOT} Ottawa, ON ${DOT} Present`);
    expect(text).toContain("https://example.com/bare");
    expect(text).not.toContain("Portfolio:");
  });

  it("keeps content order inside a section and uses the remaining headings", () => {
    const snapshot = librarySnapshot();
    snapshot.entries.push(
      {
        ref: "E6",
        id: "entry-6",
        kind: "CERTIFICATION",
        title: "AWS Cloud Practitioner",
        organization: null,
        location: null,
        startDate: "2024",
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [],
      },
      {
        ref: "E7",
        id: "entry-7",
        kind: "VOLUNTEER",
        title: "Tutor",
        organization: "Example School",
        location: null,
        startDate: null,
        endDate: "2021",
        isCurrent: false,
        url: null,
        bullets: [],
      },
      {
        ref: "E8",
        id: "entry-8",
        kind: "OTHER",
        title: "Conference talk",
        organization: null,
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [],
      },
    );
    const content = resumeContent({
      summary: { text: "", included: false },
      entries: [
        {
          ref: "E4",
          kind: "EXPERIENCE",
          included: true,
          bullets: [],
        },
        {
          ref: "E1",
          kind: "EXPERIENCE",
          included: true,
          bullets: [],
        },
        { ref: "E6", kind: "CERTIFICATION", included: true, bullets: [] },
        { ref: "E7", kind: "VOLUNTEER", included: true, bullets: [] },
        { ref: "E8", kind: "OTHER", included: true, bullets: [] },
        { ref: "E9", kind: "OTHER", included: true, bullets: [] },
      ],
    });

    const text = resumePlainText(content, snapshot);

    expect(text.indexOf("Intern")).toBeLessThan(text.indexOf("Junior Program Officer"));
    expect(text).toContain("Certifications\nAWS Cloud Practitioner\n2024");
    expect(text).toContain(`Volunteer\nTutor\nExample School ${DOT} ${EN_DASH} 2021`);
    expect(text).toContain("Other\nConference talk");
    expect(text).not.toContain("E9");
  });
});
