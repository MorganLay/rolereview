"use client";

import { useState, useTransition } from "react";

import { TurnstileWidget } from "@/components/marketing/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/copy/strings";
import { joinNewsletter } from "@/features/growth/leads/actions";
import { NEWSLETTER_CONSENT_TEXT } from "@/features/growth/leads/schemas";

const copy = strings.marketing.footer;

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [captcha, setCaptcha] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!token) {
      setFormError(strings.marketing.waitlist.captchaRequired);
      return;
    }

    startTransition(async () => {
      const result = await joinNewsletter({
        email,
        marketingConsent: consent,
        turnstileToken: token,
        consentText: NEWSLETTER_CONSENT_TEXT,
      });

      if (!result.ok) {
        if (result.error.code === "VALIDATION" && result.error.fields) {
          setFieldErrors(
            Object.fromEntries(
              Object.entries(result.error.fields).filter(
                (entry): entry is [string, string[]] => Array.isArray(entry[1]),
              ),
            ),
          );
          return;
        }
        if (result.error.code === "CAPTCHA_FAILED") {
          setFormError(strings.marketing.waitlist.captchaFailed);
          setToken(null);
          return;
        }
        setFormError(copy.newsletterError);
        return;
      }

      setDone(true);
    });
  }

  if (done) {
    return <p className="text-sm text-ink">{copy.newsletterThanks}</p>;
  }

  return (
    <form
      onSubmit={onSubmit}
      onFocus={() => setCaptcha(true)}
      className="space-y-3"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="newsletter-email">{copy.newsletterEmailLabel}</Label>
        <Input
          id="newsletter-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy.newsletterPlaceholder}
          aria-invalid={Boolean(fieldErrors.email)}
          disabled={pending}
          className="min-h-11"
        />
        {fieldErrors.email?.[0] ? (
          <p className="text-sm text-clay">{fieldErrors.email[0]}</p>
        ) : null}
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="newsletter-consent"
          checked={consent}
          onCheckedChange={(value) => setConsent(value === true)}
          disabled={pending}
          aria-invalid={Boolean(fieldErrors.marketingConsent)}
        />
        <Label
          htmlFor="newsletter-consent"
          className="text-sm font-normal leading-snug text-slate"
        >
          {NEWSLETTER_CONSENT_TEXT}
        </Label>
      </div>
      {fieldErrors.marketingConsent?.[0] ? (
        <p className="text-sm text-clay">{fieldErrors.marketingConsent[0]}</p>
      ) : null}
      {captcha ? (
        <TurnstileWidget onToken={setToken} onExpire={() => setToken(null)} />
      ) : null}
      {formError ? (
        <p className="text-sm text-clay" role="alert">
          {formError}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? copy.newsletterSubmitting : copy.newsletterSubmit}
      </Button>
    </form>
  );
}
