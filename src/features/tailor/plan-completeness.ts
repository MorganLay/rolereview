/**
 * A plan row is a decision. A heading the plan never names is unresolved.
 * This does not add the entry to the resume.
 */

export type EvidenceDisposition = "include" | "omit" | "unresolved";

type PlanRow = { ref: string; use: "lead" | "support" | "omit" };

export function planDispositions(
  entries: readonly { ref: string }[],
  evidence: readonly PlanRow[] | undefined,
): { ref: string; disposition: EvidenceDisposition }[] {
  const refs = new Set(entries.map((entry) => entry.ref));
  const decided = new Map<string, EvidenceDisposition>();
  for (const row of evidence ?? []) {
    const ref = headingRef(row.ref, refs);
    if (!ref) continue;
    const next: EvidenceDisposition = row.use === "omit" ? "omit" : "include";
    const previous = decided.get(ref);
    if (previous === "include" && next === "omit") continue;
    decided.set(ref, next);
  }
  return entries.map((entry) => ({
    ref: entry.ref,
    disposition: decided.get(entry.ref) ?? "unresolved",
  }));
}

function headingRef(ref: string, refs: ReadonlySet<string>): string | null {
  if (refs.has(ref)) return ref;
  const parent = ref.split(".")[0] ?? "";
  return refs.has(parent) ? parent : null;
}
