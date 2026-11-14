import { createHash } from "node:crypto";

export type BlindPacket = {
  caseId: string;
  job: string;
  originalResume: string;
  resumeA: string;
  resumeB: string;
  groundTruthFacts: string[];
};

export type BlindKey = {
  caseId: string;
  a: "roleRefine" | "baseline";
  b: "roleRefine" | "baseline";
};

export function blindAssignment(caseId: string, runId: string): BlindKey {
  const digest = createHash("sha256").update(`${runId}:${caseId}`).digest();
  const roleRefineFirst = (digest[0] ?? 0) % 2 === 0;
  return roleRefineFirst
    ? { caseId, a: "roleRefine", b: "baseline" }
    : { caseId, a: "baseline", b: "roleRefine" };
}

export function blindPacket(input: {
  caseId: string;
  runId: string;
  job: string;
  originalResume: string;
  roleRefine: string;
  baseline: string;
  groundTruthFacts: string[];
}): { packet: BlindPacket; key: BlindKey } {
  const key = blindAssignment(input.caseId, input.runId);
  const packet: BlindPacket = {
    caseId: input.caseId,
    job: input.job,
    originalResume: input.originalResume,
    resumeA: key.a === "roleRefine" ? input.roleRefine : input.baseline,
    resumeB: key.b === "roleRefine" ? input.roleRefine : input.baseline,
    groundTruthFacts: input.groundTruthFacts,
  };
  return { packet, key };
}

export function packetHidesIdentity(packet: BlindPacket): boolean {
  const blob = JSON.stringify(packet).toLowerCase();
  return !blob.includes("rolerefine") && !blob.includes("baseline") && !blob.includes("winner");
}

export const TRIO_ARMS = ["production", "modelLed", "direct"] as const;

export type TrioArm = (typeof TRIO_ARMS)[number];

export type TrioPacket = {
  caseId: string;
  job: string;
  originalResume: string;
  resumes: [string, string, string];
  groundTruthFacts: string[];
};

export type TrioKey = {
  caseId: string;
  order: [TrioArm, TrioArm, TrioArm];
};

/** Three resumes in a stable shuffled order. The packet does not name the arms. */
export function blindTrio(input: {
  caseId: string;
  runId: string;
  job: string;
  originalResume: string;
  production: string;
  modelLed: string;
  direct: string;
  groundTruthFacts: string[];
}): { packet: TrioPacket; key: TrioKey } {
  const key = blindTrioAssignment(input.caseId, input.runId);
  const byArm = { production: input.production, modelLed: input.modelLed, direct: input.direct };
  const packet: TrioPacket = {
    caseId: input.caseId,
    job: input.job,
    originalResume: input.originalResume,
    resumes: [byArm[key.order[0]], byArm[key.order[1]], byArm[key.order[2]]],
    groundTruthFacts: input.groundTruthFacts,
  };
  return { packet, key };
}

export function blindTrioAssignment(caseId: string, runId: string): TrioKey {
  const digest = createHash("sha256").update(`${runId}:${caseId}:trio`).digest();
  const order: TrioArm[] = [...TRIO_ARMS];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = (digest[index] ?? 0) % (index + 1);
    const current = order[index];
    const other = order[swap];
    if (!current || !other) continue;
    order[index] = other;
    order[swap] = current;
  }
  return { caseId, order: [order[0] ?? "production", order[1] ?? "modelLed", order[2] ?? "direct"] };
}

export function trioPacketHidesIdentity(packet: TrioPacket): boolean {
  const keys = Object.keys(packet);
  if (keys.some((key) => /production|model|direct|baseline|role/i.test(key))) return false;
  const blob = JSON.stringify(packet).toLowerCase();
  return !blob.includes("rolerefine") && !blob.includes("baseline") && !blob.includes("model-led") && !blob.includes("winner");
}
