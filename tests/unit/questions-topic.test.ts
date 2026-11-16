import { describe, expect, it } from "vitest";

import { resolveTopicKey, topicKey } from "@/features/questions/topic-key";

describe("topicKey", () => {
  it("treats REST API design and RESTful APIs as one topic", () => {
    expect(topicKey("REST API design", null)).toBe(topicKey("RESTful APIs", null));
    expect(topicKey("REST API design", "entry-1")).toBe(topicKey("RESTful APIs", "entry-1"));
  });

  it("keeps a different entry apart", () => {
    expect(topicKey("REST API design", "entry-1")).not.toBe(topicKey("RESTful APIs", "entry-2"));
  });

  it("reuses a known key and ignores a new one from the model", () => {
    const known = new Set([topicKey("Stripe webhooks", "entry-1")]);
    expect(resolveTopicKey(topicKey("Stripe webhooks", "entry-1"), "payments", "entry-1", known)).toBe(
      topicKey("Stripe webhooks", "entry-1"),
    );
    expect(resolveTopicKey("invented-key", "on-call rotation", "entry-1", known)).toBe(
      topicKey("on-call rotation", "entry-1"),
    );
  });

  it("folds simple plurals and drops stop words", () => {
    expect(topicKey("the booking systems", null)).toBe(topicKey("bookings", null));
  });
});
