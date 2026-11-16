/**
 * A ROLE line must start with the verb the person used, and never a stronger one.
 * Wrote, directed, reviewed, and tested stay in their own class.
 */

const CLASSES = {
  review: ["reviewed", "review", "reviewing"],
  test: ["tested", "test", "testing"],
  write: ["wrote", "write", "written", "writing"],
  direct: ["directed", "direct", "directing"],
} as const;

const RANK: Record<keyof typeof CLASSES | "build", number> = {
  review: 1,
  test: 1,
  write: 2,
  direct: 3,
  build: 3,
};

const BUILD = ["built", "build", "building", "designed", "designing", "led", "owned", "managed", "shipped", "developed", "created", "implemented", "architected"];

type VerbClass = keyof typeof RANK;

export function roleVerbAllowed(draft: string, answer: string): boolean {
  const opening = lemma(firstWord(draft));
  if (!opening) return false;
  const answerClasses = classesIn(answer);
  if (answerClasses.size === 0) return false;
  const draftClass = classOf(opening);
  if (!draftClass) return false;
  if (!answerClasses.has(draftClass)) return false;
  const answerRank = Math.max(...[...answerClasses].map((name) => RANK[name]));
  return RANK[draftClass] <= answerRank;
}

function classesIn(text: string): Set<VerbClass> {
  const found = new Set<VerbClass>();
  for (const word of words(text)) {
    const name = classOf(lemma(word));
    if (name) found.add(name);
  }
  return found;
}

function classOf(lemmaText: string): VerbClass | null {
  for (const [name, forms] of Object.entries(CLASSES) as [keyof typeof CLASSES, readonly string[]][]) {
    if (forms.includes(lemmaText)) return name;
  }
  if (BUILD.includes(lemmaText)) return "build";
  return null;
}

function lemma(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, "");
}

function firstWord(text: string): string {
  return text.trim().split(/\s+/)[0] ?? "";
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 0);
}
