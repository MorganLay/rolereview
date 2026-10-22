export const BULLET_CHECKER_MAX = 10;

export type ParsedBullets = {
  bullets: string[];
  extra: number;
};

/** One bullet per line. Leading list markers are stripped. Extra lines past 10 are dropped. */
export function parseBulletLines(
  text: string,
  max: number = BULLET_CHECKER_MAX,
): ParsedBullets {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s•\-*]+/, "").trim();
    if (line.length === 0) continue;
    lines.push(line);
  }
  return {
    bullets: lines.slice(0, max),
    extra: Math.max(0, lines.length - max),
  };
}
