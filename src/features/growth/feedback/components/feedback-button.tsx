"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { submitFeedback } from "@/features/growth/feedback/actions";
import { feedbackKindSchema } from "@/features/growth/feedback/schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";

const KINDS = feedbackKindSchema.options;

const FeedbackContext = createContext<(() => void) | null>(null);

export function useOpenFeedback(): () => void {
  const open = useContext(FeedbackContext);
  if (!open) {
    throw new Error("Feedback is only available inside the app shell.");
  }
  return open;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("IDEA");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<string>("none");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setKind("IDEA");
    setMessage("");
    setRating("none");
    setFieldError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);

    startTransition(async () => {
      const result = await submitFeedback({
        kind,
        message,
        page: pathname,
        rating: rating === "none" ? null : Number(rating),
      });

      if (!result.ok) {
        if (result.error.code === "VALIDATION" && result.error.fields?.message) {
          setFieldError(result.error.fields.message[0] ?? strings.feedback.error);
        } else {
          toast.error(strings.feedback.error);
        }
        return;
      }

      toast.success(strings.feedback.success);
      setOpen(false);
      reset();
    });
  }

  return (
    <FeedbackContext.Provider value={() => setOpen(true)}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg font-semibold">
                {strings.feedback.title}
              </DialogTitle>
              <DialogDescription>{strings.feedback.description}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="feedback-kind">{strings.feedback.kindLabel}</Label>
              <Select
                value={kind}
                onValueChange={(value) => {
                  const parsed = feedbackKindSchema.safeParse(value);
                  if (parsed.success) setKind(parsed.data);
                }}
              >
                <SelectTrigger id="feedback-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {strings.feedback.kinds[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="feedback-message">{strings.feedback.messageLabel}</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={strings.feedback.messagePlaceholder}
                rows={4}
                required
                aria-invalid={Boolean(fieldError)}
              />
              {fieldError ? <p className="text-sm text-destructive">{fieldError}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="feedback-rating">{strings.feedback.ratingLabel}</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger id="feedback-rating" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{strings.feedback.ratingNone}</SelectItem>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                {strings.common.cancel}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? strings.common.loading : strings.common.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </FeedbackContext.Provider>
  );
}

/** Desktop sidebar. Hidden below `md`, where Feedback lives in the account menu. */
export function FeedbackSidebarButton() {
  const open = useOpenFeedback();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mb-3 hidden w-full md:inline-flex"
      onClick={open}
    >
      <MessageSquarePlus aria-hidden data-icon="inline-start" />
      {strings.feedback.button}
    </Button>
  );
}
