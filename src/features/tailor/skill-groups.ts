/**
 * Export grouping for skills. Empty groups are omitted.
 * A skill is listed once, in the first group that fits.
 */

export const SKILL_BUCKETS = [
  "Languages",
  "Data and Analytics",
  "Frameworks and Tools",
  "Cloud and Infrastructure",
  "Practices",
] as const;

export type SkillBucket = (typeof SKILL_BUCKETS)[number];

const BUCKET_BY_NAME: Record<string, SkillBucket> = {
  python: "Languages",
  sql: "Languages",
  javascript: "Languages",
  typescript: "Languages",
  java: "Languages",
  "c#": "Languages",
  "c++": "Languages",
  go: "Languages",
  golang: "Languages",
  r: "Languages",
  scala: "Languages",
  ruby: "Languages",
  rust: "Languages",
  php: "Languages",
  kotlin: "Languages",
  swift: "Languages",
  html: "Languages",
  css: "Languages",
  sass: "Languages",
  bash: "Languages",
  excel: "Data and Analytics",
  "microsoft excel": "Data and Analytics",
  "ms excel": "Data and Analytics",
  "power bi": "Data and Analytics",
  powerbi: "Data and Analytics",
  "microsoft power bi": "Data and Analytics",
  "power query": "Data and Analytics",
  tableau: "Data and Analytics",
  looker: "Data and Analytics",
  cognos: "Data and Analytics",
  "ibm cognos": "Data and Analytics",
  pandas: "Data and Analytics",
  numpy: "Data and Analytics",
  spark: "Data and Analytics",
  hadoop: "Data and Analytics",
  snowflake: "Data and Analytics",
  bigquery: "Data and Analytics",
  sas: "Data and Analytics",
  spss: "Data and Analytics",
  alteryx: "Data and Analytics",
  dbt: "Data and Analytics",
  react: "Frameworks and Tools",
  "react.js": "Frameworks and Tools",
  django: "Frameworks and Tools",
  flask: "Frameworks and Tools",
  "node.js": "Frameworks and Tools",
  nodejs: "Frameworks and Tools",
  "next.js": "Frameworks and Tools",
  docker: "Frameworks and Tools",
  git: "Frameworks and Tools",
  github: "Frameworks and Tools",
  gitlab: "Frameworks and Tools",
  figma: "Frameworks and Tools",
  playwright: "Frameworks and Tools",
  jest: "Frameworks and Tools",
  aws: "Cloud and Infrastructure",
  "amazon web services": "Cloud and Infrastructure",
  azure: "Cloud and Infrastructure",
  gcp: "Cloud and Infrastructure",
  "google cloud platform": "Cloud and Infrastructure",
  kubernetes: "Cloud and Infrastructure",
  terraform: "Cloud and Infrastructure",
  linux: "Cloud and Infrastructure",
  agile: "Practices",
  scrum: "Practices",
  "ci/cd": "Practices",
  cicd: "Practices",
};

const BUCKET_BY_CATEGORY: Record<string, SkillBucket> = {
  language: "Languages",
  languages: "Languages",
  data: "Data and Analytics",
  analytics: "Data and Analytics",
  "data and analytics": "Data and Analytics",
  bi: "Data and Analytics",
  tool: "Frameworks and Tools",
  tools: "Frameworks and Tools",
  framework: "Frameworks and Tools",
  frameworks: "Frameworks and Tools",
  "frameworks and tools": "Frameworks and Tools",
  cloud: "Cloud and Infrastructure",
  infrastructure: "Cloud and Infrastructure",
  "cloud and infrastructure": "Cloud and Infrastructure",
  practice: "Practices",
  practices: "Practices",
  method: "Practices",
  methods: "Practices",
};

export type SkillGroupInput = {
  category: string | null;
  names: readonly string[];
};

/** Lines for the PDF, DOCX, and plain-text resume. */
export function groupedSkillLines(groups: readonly SkillGroupInput[]): string[] {
  const bucketNames = new Map<SkillBucket, string[]>();
  const other: { category: string; names: string[] }[] = [];
  const loose: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const raw of group.names) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (name.length === 0 || seen.has(key)) continue;
      seen.add(key);
      const bucket = bucketFor(name, group.category);
      if (bucket) {
        const list = bucketNames.get(bucket) ?? [];
        list.push(name);
        bucketNames.set(bucket, list);
        continue;
      }
      const category = group.category?.trim() ?? "";
      if (category.length === 0) {
        loose.push(name);
        continue;
      }
      const existing = other.find(
        (item) => item.category.toLowerCase() === category.toLowerCase(),
      );
      if (existing) existing.names.push(name);
      else other.push({ category, names: [name] });
    }
  }

  const lines: string[] = [];
  for (const bucket of SKILL_BUCKETS) {
    const names = bucketNames.get(bucket);
    if (!names || names.length === 0) continue;
    lines.push(`${bucket}: ${names.join(", ")}`);
  }
  for (const group of other) lines.push(`${group.category}: ${group.names.join(", ")}`);
  if (loose.length > 0) lines.push(loose.join(", "));
  return lines;
}

function bucketFor(name: string, category: string | null): SkillBucket | null {
  const byName = BUCKET_BY_NAME[name.trim().toLowerCase()];
  if (byName) return byName;
  const label = category?.trim().toLowerCase() ?? "";
  return BUCKET_BY_CATEGORY[label] ?? null;
}
