import "server-only";

import { takeLimitedSlot } from "@/features/billing/hold";
import { db } from "@/lib/db";

import { KEYWORD_CHECKER_DAILY_LIMIT } from "./limit";

/** Write the rate-limit row before the model call so a parallel request sees it. */
export async function reserveKeywordRun(
  ipHash: string,
): Promise<{ ok: true; id: string } | { ok: false }> {
  return db.$transaction((tx) =>
    takeLimitedSlot(
      async () => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ipHash}))`;
        return () => {};
      },
      () => tx.freeToolRun.count({ where: { ipHash, tool: "KEYWORD_CHECKER" } }),
      async () => {
        const row = await tx.freeToolRun.create({
          data: { tool: "KEYWORD_CHECKER", ipHash, success: false },
        });
        return row.id;
      },
      KEYWORD_CHECKER_DAILY_LIMIT,
    ),
  );
}

export async function settleKeywordRun(
  id: string,
  input: { success: boolean; inputTokens: number; outputTokens: number },
): Promise<void> {
  await db.freeToolRun.updateMany({
    where: { id, tool: "KEYWORD_CHECKER" },
    data: {
      success: input.success,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    },
  });
}
