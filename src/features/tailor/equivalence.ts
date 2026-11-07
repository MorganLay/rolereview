/**
 * Spelling and product-name aliases for keyword coverage and the tailor guard.
 * Short or ambiguous tokens (js, ts, ml, go, r) are not aliases.
 */

const GROUPS: readonly (readonly string[])[] = [
  ["excel", "microsoft excel", "ms excel"],
  ["postgres", "postgresql"],
  ["power bi", "powerbi", "microsoft power bi"],
  ["power query", "powerquery"],
  ["node.js", "nodejs", "node"],
  ["next.js", "nextjs"],
  ["react.js", "reactjs"],
  ["ci/cd", "cicd"],
  ["scikit-learn", "scikit learn", "sklearn"],
  [".net", "dotnet"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp"],
  ["kubernetes", "k8s"],
  ["ibm cognos", "cognos"],
];

const CANONICAL = new Map<string, readonly string[]>();
for (const group of GROUPS) {
  for (const form of group) CANONICAL.set(form, group);
}

/** Other spellings of a normalised term, not including the term itself. */
export function equivalentForms(normalized: string): string[] {
  const group = CANONICAL.get(normalized);
  if (!group) return [];
  return group.filter((form) => form !== normalized);
}
