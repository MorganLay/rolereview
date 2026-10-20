/**
 * Dev check for T4.1. One ANALYZE call, then the new AiCall row's tokens and cost.
 * Does not print the posting or the model text.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { PrismaClient } from "../src/generated/prisma/client";
import { runStructured } from "../src/lib/ai/run";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const Output = z.object({
  title: z.string(),
});

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("ai:analyze is dev only.");
    process.exitCode = 1;
    return;
  }

  const userId = process.env.SEED_USER_ID?.trim() ?? "";
  if (!UUID.test(userId)) {
    console.error("Set SEED_USER_ID in .env to your Supabase user id.");
    process.exitCode = 1;
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes("<")) {
    console.error("Set ANTHROPIC_API_KEY in .env.");
    process.exitCode = 1;
    return;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Set DATABASE_URL in .env.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      console.error(
        "No User row for SEED_USER_ID. Sign in once, then run npm run ai:analyze again.",
      );
      process.exitCode = 1;
      return;
    }

    const startedAt = new Date(Date.now() - 2 * 60 * 1000);
    const result = await runStructured({
      kind: "ANALYZE",
      userId,
      usedBonusCredit: false,
      system: "Extract the job title from the posting.",
      content: [
        {
          type: "text",
          text: "<posting>Office assistant, River City Library.</posting>",
        },
      ],
      schema: Output,
    });

    const row = await prisma.aiCall.findFirst({
      where: { userId, kind: "ANALYZE", createdAt: { gte: startedAt } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        success: true,
        errorCode: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
        costMicros: true,
      },
    });

    if (!row) {
      console.error("No AiCall row was written.");
      process.exitCode = 1;
      return;
    }

    console.log(
      [
        `AiCall ${row.id}`,
        `success ${row.success}`,
        `errorCode ${row.errorCode ?? ""}`,
        `inputTokens ${row.inputTokens}`,
        `outputTokens ${row.outputTokens}`,
        `cacheReadTokens ${row.cacheReadTokens}`,
        `cacheWriteTokens ${row.cacheWriteTokens}`,
        `costMicros ${row.costMicros}`,
      ].join("\n"),
    );

    const hasTokens = row.inputTokens + row.outputTokens > 0;
    if (!result.ok || !row.success || !hasTokens || row.costMicros <= 0) {
      process.exitCode = 1;
    }
  } catch {
    console.error("ANALYZE did not finish. Check the ai.call log line for a code.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
