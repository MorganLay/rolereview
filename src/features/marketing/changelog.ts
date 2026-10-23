export type ChangelogMeta = {
  title: string;
  date: string;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC calendar date, or null when the string is not a real YYYY-MM-DD day. */
export function parseChangelogDate(isoDate: string): Date | null {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** "October 22, 2026" in UTC. Invalid input is returned unchanged. */
export function formatChangelogDate(isoDate: string): string {
  const date = parseChangelogDate(isoDate);
  if (!date) return isoDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Newest date first. Same-day notes stay in title order. */
export function sortChangelog<T extends ChangelogMeta>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.title.localeCompare(b.title);
  });
}
