"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/copy/strings";
import { createClient } from "@/lib/supabase/client";

type Props = {
  next: string;
  error?: string;
};

export function SignInForm({ next, error }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    error === "auth" ? strings.signIn.errors.auth : null,
  );
  const [pending, startTransition] = useTransition();

  function callbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next);
    return url.toString();
  }

  function onMagicLink(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callbackUrl() },
      });
      if (otpError) {
        setFormError(strings.signIn.errors.sendLink);
        return;
      }
      setSent(true);
    });
  }

  function onGoogle() {
    setFormError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl() },
      });
      if (oauthError) {
        setFormError(strings.signIn.errors.google);
      }
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-base text-ink">{strings.signIn.checkEmailTitle}</p>
        <p className="text-sm text-slate">{strings.signIn.checkEmailBody}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <form onSubmit={onMagicLink} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{strings.signIn.emailLabel}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={strings.signIn.emailPlaceholder}
            disabled={pending}
          />
        </div>
        <Button type="submit" disabled={pending || !email.trim()}>
          {pending ? strings.common.loading : strings.signIn.sendMagicLink}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-slate">{strings.signIn.or}</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onGoogle}
        disabled={pending}
      >
        {strings.signIn.continueWithGoogle}
      </Button>

      {formError ? (
        <p className="text-sm text-clay" role="alert">
          {formError}
        </p>
      ) : null}
    </div>
  );
}
