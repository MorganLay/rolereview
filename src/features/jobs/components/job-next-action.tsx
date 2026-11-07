"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

import {
  nextAction,
  nextActionLabel,
  type NextActionInput,
} from "../next-action";

export function JobNextActionLink({
  input,
  size = "default",
  variant = "default",
  className,
  stopPointer = false,
}: {
  input: NextActionInput;
  size?: "default" | "sm";
  variant?: "default" | "link";
  className?: string;
  /** Keep a board drag from starting on this control. */
  stopPointer?: boolean;
}) {
  const action = nextAction(input);
  if (!action) return null;
  const button = (
    <Button asChild size={size} variant={variant} className={className}>
      <Link href={action.href}>{nextActionLabel(action.kind)}</Link>
    </Button>
  );
  if (!stopPointer) return button;
  return (
    <div className="mt-2" onPointerDown={(event) => event.stopPropagation()}>
      {button}
    </div>
  );
}
