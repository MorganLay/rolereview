"use server";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { TESTIMONIAL_CONSENT_TEXT, testimonialSchema } from "./schemas";

export type AcceptedPrompt = {
  showTestimonial: boolean;
  showPause: boolean;
};

/** Whether the Accepted dialog should offer a note and the billing portal. */
export async function acceptedPrompt(): Promise<ActionResult<AcceptedPrompt>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const [row, existing] = await Promise.all([
    db.user.findFirst({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    }),
    db.testimonial.findFirst({
      where: { userId: user.id },
      select: { id: true },
    }),
  ]);
  if (!row) return fail("NOT_FOUND");

  return ok({
    showTestimonial: existing === null,
    showPause: row.stripeCustomerId !== null,
  });
}

/** Store one consented testimonial. It stays unpublished until an admin approves it. */
export async function submitTestimonial(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.testimonial.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) return fail("CONFLICT");

  const row = await db.testimonial.create({
    data: {
      userId: user.id,
      displayName: parsed.data.displayName,
      roleTitle: parsed.data.roleTitle,
      quote: parsed.data.quote,
      consentAt: new Date(),
      consentText: TESTIMONIAL_CONSENT_TEXT,
      approved: false,
      featured: false,
    },
    select: { id: true },
  });

  return ok({ id: row.id });
}
