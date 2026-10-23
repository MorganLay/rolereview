type FixtureBullet = { text: string };
type FixtureEntry = {
  kind: string;
  title: string;
  organization: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  bullets: FixtureBullet[];
};
type FixtureSkill = { name: string; category: string | null };
type FixtureLibrary = {
  profile: {
    fullName: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    links: { label: string; url: string }[];
    summary: string;
  };
  entries: FixtureEntry[];
  skills: FixtureSkill[];
};

const KIND_HEADING: Record<string, string> = {
  EXPERIENCE: "Experience",
  PROJECT: "Project",
  EDUCATION: "Education",
  CERTIFICATION: "Certification",
  VOLUNTEER: "Volunteer",
  OTHER: "Other",
};

function dates(entry: FixtureEntry): string {
  if (entry.isCurrent) return `${entry.startDate} – present`;
  if (entry.endDate) return `${entry.startDate} – ${entry.endDate}`;
  return entry.startDate;
}

/** Plain resume text for the import paste tab. Fake people only. */
export function libraryToResumeText(library: FixtureLibrary): string {
  const { profile } = library;
  const lines: string[] = [
    profile.fullName,
    profile.headline,
    profile.email,
    profile.phone,
    profile.location,
    ...profile.links.map((link) => `${link.label}: ${link.url}`),
    "",
    profile.summary,
    "",
  ];

  for (const entry of library.entries) {
    const heading = KIND_HEADING[entry.kind] ?? entry.kind;
    const where = entry.location
      ? `${entry.organization}, ${entry.location}`
      : entry.organization;
    lines.push(heading);
    lines.push(`${entry.title} — ${where}`);
    lines.push(dates(entry));
    for (const bullet of entry.bullets) {
      lines.push(`- ${bullet.text}`);
    }
    lines.push("");
  }

  if (library.skills.length > 0) {
    lines.push("Skills");
    lines.push(library.skills.map((skill) => skill.name).join(", "));
  }

  return lines.join("\n").trim();
}
