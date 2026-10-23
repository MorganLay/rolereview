export const WELCOME_TEMPLATE = "welcome";
export const PRODUCT_UPDATES_TEMPLATE = "product-updates";

const EMAIL_TEMPLATES = {
  [WELCOME_TEMPLATE]: { marketing: false },
  [PRODUCT_UPDATES_TEMPLATE]: { marketing: true },
} as const;

export type EmailTemplateName = keyof typeof EMAIL_TEMPLATES;

export type EmailDecision =
  | "send"
  | "already-sent"
  | "no-consent"
  | "no-address"
  | "unconfigured"
  | "unknown-template"
  | "preview";

export function isEmailTemplate(template: string): template is EmailTemplateName {
  return Object.prototype.hasOwnProperty.call(EMAIL_TEMPLATES, template);
}

export function isMarketingTemplate(template: string): boolean {
  return isEmailTemplate(template) && EMAIL_TEMPLATES[template].marketing;
}

/**
 * Whether a send should go out. Marketing mail needs stored consent and a
 * real postal address. Welcome does not. An existing EmailLog row wins first.
 */
export function decideEmailSend(input: {
  template: string;
  alreadySent: boolean;
  marketingConsent: boolean;
  configured: boolean;
  hasMailingAddress: boolean;
  preview?: boolean;
}): EmailDecision {
  if (!isEmailTemplate(input.template)) return "unknown-template";
  if (input.alreadySent) return "already-sent";
  if (input.preview) return "preview";
  if (isMarketingTemplate(input.template) && !input.marketingConsent) return "no-consent";
  if (isMarketingTemplate(input.template) && !input.hasMailingAddress) return "no-address";
  if (!input.configured) return "unconfigured";
  return "send";
}
