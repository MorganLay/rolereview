"use client";

import { useState, useTransition } from "react";

import { TurnstileWidget } from "@/components/marketing/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/copy/strings";

import { joinWaitlist } from "../actions";
import { WAITLIST_CONSENT_TEXT } from "../schemas";

type WaitlistFormProps = {
  appUrl: string;
};

export function WaitlistForm({ appUrl }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!token) {
      setFormError(strings.marketing.waitlist.captchaRequired);
      return;
    }

    startTransition(async () => {
      const result = await joinWaitlist({
        email,
        marketingConsent: consent,
        turnstileToken: token,
        consentText: WAITLIST_CONSENT_TEXT,
      });

      if (!result.ok) {
        if (result.error.code === "VALIDATION" && result.error.fields) {
          setFieldErrors(
            Object.fromEntries(
              Object.entries(result.error.fields).filter(
                (entry): entry is [string, string[]] =>
                  Array.isArray(entry[1]),
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
        setFormError(strings.marketing.waitlist.error);
        return;
      }

      const base = appUrl.replace(/\/$/, "");
      setShareUrl(`${base}/?ref=${result.data.shareRef}`);
    });
  }

  if (shareUrl) {
    return (
      <div className="w-full max-w-md space-y-4 rounded-card border border-line bg-surface p-6 text-left">
        <h2 className="font-serif text-xl font-semibold text-ink">
          {strings.marketing.waitlist.thanksTitle}
        </h2>
        <p className="text-sm text-slate">
          {strings.marketing.waitlist.thanksBody}
        </p>
        <div className="space-y-2">
          <Label htmlFor="share-link">
            {strings.marketing.waitlist.shareLabel}
          </Label>
          <Input
            id="share-link"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
        <p className="text-sm text-slate">
          {strings.marketing.waitlist.inviteHint}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md space-y-4 rounded-card border border-line bg-surface p-6 text-left"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="waitlist-email">
          {strings.marketing.waitlist.emailLabel}
        </Label>
        <Input
          id="waitlist-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={strings.marketing.waitlist.emailPlaceholder}
          aria-invalid={Boolean(fieldErrors.email)}
          disabled={pending}
        />
        {fieldErrors.email?.[0] ? (
          <p className="text-sm text-clay">{fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="waitlist-consent"
          checked={consent}
          onCheckedChange={(value) => setConsent(value === true)}
          disabled={pending}
          aria-invalid={Boolean(fieldErrors.marketingConsent)}
        />
        <Label
          htmlFor="waitlist-consent"
          className="text-sm font-normal leading-snug text-slate"
        >
          {WAITLIST_CONSENT_TEXT}
        </Label>
      </div>
      {fieldErrors.marketingConsent?.[0] ? (
        <p className="text-sm text-clay">{fieldErrors.marketingConsent[0]}</p>
      ) : null}

      <TurnstileWidget
        onToken={setToken}
        onExpire={() => setToken(null)}
      />

      {formError ? (
        <p className="text-sm text-clay" role="alert">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending
          ? strings.marketing.waitlist.submitting
          : strings.marketing.waitlist.submit}
      </Button>
    </form>
  );
}
