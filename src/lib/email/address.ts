/** The sample line in `.env.example`. It is not a real postal address. */
export const EXAMPLE_MAILING_ADDRESS = "Your mailing address, Ottawa, ON, Canada";

/** A street address or PO box safe to print on an email. The example line is omitted. */
export function publicMailingAddress(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === EXAMPLE_MAILING_ADDRESS) return null;
  return trimmed;
}
