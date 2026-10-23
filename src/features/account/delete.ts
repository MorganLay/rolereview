/**
 * Account deletion decisions that do not touch Stripe or the database.
 * A missing subscription can be cancelled again; any other Stripe error stops the delete.
 */

export function subscriptionCancelCanContinue(code: string | undefined): boolean {
  return code === "resource_missing";
}
