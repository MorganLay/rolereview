/** Local snapshot page. Production and every other account get a 404. */
export function devSnapshotsOpen(input: {
  nodeEnv: string;
  seedUserId: string | undefined;
  userId: string;
}): boolean {
  if (input.nodeEnv === "production") return false;
  const seedUserId = input.seedUserId?.trim();
  if (!seedUserId) return false;
  return seedUserId === input.userId;
}
