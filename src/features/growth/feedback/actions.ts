"use server";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { submitFeedbackSchema } from "./schemas";

export async function submitFeedback(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = submitFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const { kind, message, page, rating } = parsed.data;

  const row = await db.feedback.create({
    data: {
      userId: user.id,
      kind,
      message,
      page: page ?? null,
      rating: rating ?? null,
    },
    select: { id: true },
  });

  return ok({ id: row.id });
}
