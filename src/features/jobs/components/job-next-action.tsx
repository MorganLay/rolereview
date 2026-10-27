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
  className,
  stopPointer = false,
}: {
  input: NextActionInput;
  size?: "default" | "sm";
  className?: string;
  /** Keep a board drag from starting on this control. */
  stopPointer?: boolean;
}) {
  const action = nextAction(input);
  if (!action) return null;
  const button = (
    <Button asChild size={size} className={className}>
      <Link href={action.href}>{nextActionLabel(action.kind)}</Link>
    </Button>
  );
  if (!stopPointer) return button;
  return (
    <div className="mt-3" onPointerDown={(event) => event.stopPropagation()}>
      {button}
    </div>
  );
}
