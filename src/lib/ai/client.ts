import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

let client: Anthropic | undefined;

/** Shared Claude client. Throws only when a call is attempted without a key. */
export function getAnthropic(): Anthropic {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  client ??= new Anthropic({
    apiKey,
    timeout: 120_000,
    maxRetries: 2,
  });
  return client;
}
