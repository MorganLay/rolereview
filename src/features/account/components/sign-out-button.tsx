"use client";

import { useTransition } from "react";

import { signOut } from "@/features/account/actions";
import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          void signOut();
        });
      }}
    >
      {pending ? strings.common.loading : strings.auth.signOut}
    </Button>
  );
}
