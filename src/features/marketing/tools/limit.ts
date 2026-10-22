export const KEYWORD_CHECKER_DAILY_LIMIT = 3;
export const MUST_HAVE_LIMIT = 5;

export function isKeywordCheckerLimited(runCount: number): boolean {
  return runCount >= KEYWORD_CHECKER_DAILY_LIMIT;
}

export function topMustHaveTexts(
  requirements: readonly { text: string; importance: string }[],
  limit: number = MUST_HAVE_LIMIT,
): string[] {
  const texts: string[] = [];
  for (const requirement of requirements) {
    if (requirement.importance !== "must") continue;
    const text = requirement.text.trim();
    if (text.length === 0) continue;
    texts.push(text);
    if (texts.length === limit) break;
  }
  return texts;
}
