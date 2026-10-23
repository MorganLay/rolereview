"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { createPortalSession } from "@/features/billing/actions";
import {
  acceptedPrompt,
  submitTestimonial,
  type AcceptedPrompt,
} from "@/features/growth/testimonials/actions";
import { TESTIMONIAL_LIMITS } from "@/features/growth/testimonials/schemas";

const copy = strings.jobs.offer;

/**
 * Shown once, after a status change to Accepted.
 * The app stylesheet drops motion when the user prefers reduced motion.
 */
export function AcceptedCelebration({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [prompt, setPrompt] = useState<AcceptedPrompt | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [quote, setQuote] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [pausing, setPausing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void acceptedPrompt().then((result) => {
      if (cancelled || !result.ok) return;
      setPrompt(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function reset() {
    setPrompt(null);
    setDisplayName("");
    setRoleTitle("");
    setQuote("");
    setConsent(false);
    setSending(false);
    setSent(false);
    setPausing(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function onTestimonial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !consent) return;
    setSending(true);
    const result = await submitTestimonial({
      displayName,
      roleTitle,
      quote,
      consent: true,
    });
    setSending(false);
    if (result.ok) {
      setSent(true);
      toast.success(copy.testimonialSent);
      return;
    }
    if (result.error.code === "CONFLICT") {
      setSent(true);
      toast.error(copy.testimonialConflict);
      return;
    }
    toast.error(
      result.error.code === "VALIDATION" ? copy.testimonialInvalid : copy.testimonialError,
    );
  }

  async function onPause() {
    if (pausing) return;
    setPausing(true);
    const result = await createPortalSession({});
    setPausing(false);
    if (!result.ok) {
      toast.error(copy.pauseError);
      return;
    }
    window.location.assign(result.data.url);
  }

  const showForm = prompt?.showTestimonial === true && !sent;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto duration-200 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-sans">{copy.acceptedTitle}</DialogTitle>
          <DialogDescription>{copy.acceptedBody}</DialogDescription>
        </DialogHeader>

        {showForm ? (
          <form onSubmit={onTestimonial} className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-ink">{copy.testimonialTitle}</p>
              <p className="mt-1 text-sm text-slate">{copy.testimonialBody}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="testimonial-name">{copy.testimonialName}</Label>
              <Input
                id="testimonial-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={TESTIMONIAL_LIMITS.displayName}
                className="h-11"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="testimonial-role">{copy.testimonialRole}</Label>
              <Input
                id="testimonial-role"
                value={roleTitle}
                onChange={(event) => setRoleTitle(event.target.value)}
                maxLength={TESTIMONIAL_LIMITS.roleTitle}
                placeholder={copy.testimonialRoleHint}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="testimonial-quote">{copy.testimonialQuote}</Label>
              <Textarea
                id="testimonial-quote"
                value={quote}
                onChange={(event) => setQuote(event.target.value)}
                maxLength={TESTIMONIAL_LIMITS.quote}
                className="min-h-24"
                required
              />
            </div>
            <div className="flex min-h-11 items-start gap-3">
              <Checkbox
                id="testimonial-consent"
                checked={consent}
                onCheckedChange={(value) => setConsent(value === true)}
                className="mt-0.5"
              />
              <Label htmlFor="testimonial-consent" className="text-sm leading-5 font-normal">
                {copy.testimonialConsent}
              </Label>
            </div>
            <Button type="submit" className="min-h-11 w-fit" disabled={sending || !consent}>
              {sending ? copy.testimonialSending : copy.testimonialSubmit}
            </Button>
          </form>
        ) : null}

        {sent ? (
          <p role="status" className="text-sm text-ink">
            {copy.testimonialSent}
          </p>
        ) : null}

        {prompt?.showPause ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-fit"
              disabled={pausing}
              onClick={() => void onPause()}
            >
              {pausing ? copy.pauseOpening : copy.pause}
            </Button>
            <p className="text-sm text-slate">{copy.pauseBody}</p>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" className="min-h-11" onClick={() => handleOpenChange(false)}>
            {copy.acceptedDone}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
