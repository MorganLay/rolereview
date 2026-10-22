"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

let sessionPromise: Promise<boolean> | null = null;

function readSession(): Promise<boolean> {
  if (!sessionPromise) {
    const supabase = createClient();
    sessionPromise = supabase.auth
      .getSession()
      .then(({ data }) => Boolean(data.session));
  }
  return sessionPromise;
}

/**
 * Marketing CTAs start signed-out on the server, then update after mount.
 * Avoids reading cookies in the static marketing layout.
 */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void readSession().then(setSignedIn);
  }, []);

  return signedIn;
}
