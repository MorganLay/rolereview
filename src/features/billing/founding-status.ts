import "server-only";

export type FoundingDecision = "apply" | "skip" | "blocked";

/**
 * The founding discount is not offered. A stored `foundingOffer` flag does not
 * change the price, and checkout is not blocked while a coupon is checked.
 */
export async function decideFounding(): Promise<FoundingDecision> {
  return "skip";
}
