"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { strings } from "@/copy/strings";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="duration-200 sm:max-w-sm">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-sans">{copy.acceptedTitle}</DialogTitle>
          <DialogDescription>{copy.acceptedBody}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {copy.acceptedDone}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
