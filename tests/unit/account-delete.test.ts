import { describe, expect, it } from "vitest";

import { subscriptionCancelCanContinue } from "@/features/account/delete";
import { DELETE_CONFIRMATION, deleteAccountSchema } from "@/features/account/schemas";

describe("deleteAccountSchema", () => {
  it("accepts only the exact word DELETE", () => {
    expect(DELETE_CONFIRMATION).toBe("DELETE");
    expect(deleteAccountSchema.safeParse({ confirmation: "DELETE" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirmation: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: "DELETE " }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: "" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
  });
});

describe("subscriptionCancelCanContinue", () => {
  it("continues only when Stripe says the subscription is already gone", () => {
    expect(subscriptionCancelCanContinue("resource_missing")).toBe(true);
    expect(subscriptionCancelCanContinue("card_declined")).toBe(false);
    expect(subscriptionCancelCanContinue(undefined)).toBe(false);
    expect(subscriptionCancelCanContinue("")).toBe(false);
  });
});
