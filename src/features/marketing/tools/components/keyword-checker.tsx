"use client";

import { useEffect, useState, useTransition } from "react";

import { TurnstileWidget } from "@/components/marketing/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { emailKeywordReport } from "@/features/growth/leads/actions";
import { KEYWORD_REPORT_CONSENT_TEXT } from "@/features/growth/leads/schemas";
import { CtaLink } from "@/features/marketing/components/cta-link";
import { cn } from "@/lib/utils";

import { checkKeywordCoverage } from "../actions";
import type { KeywordReport } from "../schemas";

const copy = strings.marketing.tools.keyword;
const waitlist = strings.marketing.waitlist;

export function KeywordChecker() {
  const [posting, setPosting] = useState("");
  const [resume, setResume] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [report, setReport] = useState<KeywordReport | null>(null);
  const [stage, setStage] = useState(0);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => {
      setStage((current) => (current + 1) % copy.stages.length);
    }, 2500);
    return () => window.clearInterval(id);
  }, [pending]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!token) {
      setFormError(waitlist.captchaRequired);
      return;
    }

    startTransition(async () => {
      setStage(0);
      const result = await checkKeywordCoverage({
        posting,
        resume,
        turnstileToken: token,
      });
      setToken(null);
      setCaptchaKey((current) => current + 1);

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
          setFormError(waitlist.captchaFailed);
          return;
        }
        if (result.error.code === "RATE_LIMITED") {
          setFormError(copy.rateLimited);
          return;
        }
        if (result.error.code === "AI_FAILED") {
          setFormError(copy.aiFailed);
          return;
        }
        setFormError(copy.unavailable);
        return;
      }

      setReport(result.data);
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <div className="space-y-2">
          <Label htmlFor="keyword-posting">{copy.postingLabel}</Label>
          <Textarea
            id="keyword-posting"
            name="posting"
            value={posting}
            onChange={(event) => setPosting(event.target.value)}
            placeholder={copy.postingPlaceholder}
            className="min-h-40 text-sm"
            aria-invalid={Boolean(fieldErrors.posting)}
            disabled={pending}
          />
          {fieldErrors.posting?.[0] ? (
            <p className="text-sm text-clay">{fieldErrors.posting[0]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="keyword-resume">{copy.resumeLabel}</Label>
          <Textarea
            id="keyword-resume"
            name="resume"
            value={resume}
            onChange={(event) => setResume(event.target.value)}
            placeholder={copy.resumePlaceholder}
            className="min-h-40 text-sm"
            aria-invalid={Boolean(fieldErrors.resume)}
            disabled={pending}
          />
          {fieldErrors.resume?.[0] ? (
            <p className="text-sm text-clay">{fieldErrors.resume[0]}</p>
          ) : null}
        </div>

        <TurnstileWidget
          key={captchaKey}
          onToken={setToken}
          onExpire={() => setToken(null)}
        />

        {formError ? (
          <p className="text-sm text-clay" role="alert">
            {formError}
          </p>
        ) : null}

        {pending ? (
          <div className="space-y-1" aria-live="polite">
            <p className="text-sm font-medium text-ink">{copy.reading}</p>
            {copy.stages.map((line, index) => (
              <p
                key={line}
                className={index === stage ? "text-sm text-ink" : "text-sm text-slate"}
                aria-current={index === stage ? "step" : undefined}
              >
                {line}
              </p>
            ))}
          </div>
        ) : null}

        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? copy.submitting : copy.submit}
        </Button>
      </form>

      {report ? <KeywordReportCard report={report} /> : null}
    </div>
  );
}

function KeywordReportCard({ report }: { report: KeywordReport }) {
  return (
    <div className="space-y-8 rounded-card border border-line bg-surface p-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink">
          {copy.coverage(report.coveragePct)}
        </h2>
        {report.covered.length === 0 && report.missing.length === 0 ? (
          <p className="mt-3 text-sm text-slate">{copy.noKeywords}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <KeywordChips heading={copy.covered} keywords={report.covered} tone="covered" />
            <KeywordChips heading={copy.missing} keywords={report.missing} tone="missing" />
          </div>
        )}
      </div>

      <div>
        <h3 className="text-base font-medium text-ink">{copy.mustHaves}</h3>
        {report.mustHaves.length === 0 ? (
          <p className="mt-2 text-sm text-slate">{copy.noMustHaves}</p>
        ) : (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink">
            {report.mustHaves.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm text-slate">{copy.ctaLead}</p>
        <CtaLink
          location="keyword-checker"
          signedOutLabel={copy.tailorCta}
        />
      </div>

      <EmailReportForm />
    </div>
  );
}

function KeywordChips({
  heading,
  keywords,
  tone,
}: {
  heading: string;
  keywords: readonly string[];
  tone: "covered" | "missing";
}) {
  if (keywords.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate">{heading}</p>
      <ul className="flex flex-wrap gap-2">
        {keywords.map((keyword, index) => (
          <li
            key={`${keyword}-${index}`}
            className={cn(
              "max-w-full rounded-full px-2.5 py-0.5 text-xs break-words text-ink",
              tone === "covered" ? "bg-pine-50" : "border border-clay",
            )}
          >
            {keyword}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmailReportForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!token) {
      setFormError(waitlist.captchaRequired);
      return;
    }

    startTransition(async () => {
      const result = await emailKeywordReport({
        email,
        marketingConsent: consent,
        turnstileToken: token,
        consentText: KEYWORD_REPORT_CONSENT_TEXT,
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
          setFormError(waitlist.captchaFailed);
          setToken(null);
          return;
        }
        if (result.error.code === "RATE_LIMITED") {
          setFormError(copy.emailRateLimited);
          return;
        }
        setFormError(copy.emailError);
        return;
      }

      setDone(true);
    });
  }

  if (done) {
    return <p className="text-sm text-ink">{copy.emailThanks}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t border-line pt-6" noValidate>
      <div>
        <h3 className="text-base font-medium text-ink">{copy.emailTitle}</h3>
        <p className="mt-1 text-sm text-slate">{copy.emailBody}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="keyword-email">{copy.emailLabel}</Label>
        <Input
          id="keyword-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy.emailPlaceholder}
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
          id="keyword-consent"
          checked={consent}
          onCheckedChange={(value) => setConsent(value === true)}
          disabled={pending}
          aria-invalid={Boolean(fieldErrors.marketingConsent)}
        />
        <Label
          htmlFor="keyword-consent"
          className="text-sm font-normal leading-snug text-slate"
        >
          {KEYWORD_REPORT_CONSENT_TEXT}
        </Label>
      </div>
      {fieldErrors.marketingConsent?.[0] ? (
        <p className="text-sm text-clay">{fieldErrors.marketingConsent[0]}</p>
      ) : null}
      <TurnstileWidget onToken={setToken} onExpire={() => setToken(null)} />
      {formError ? (
        <p className="text-sm text-clay" role="alert">
          {formError}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? copy.emailSubmitting : copy.emailSubmit}
      </Button>
    </form>
  );
}
