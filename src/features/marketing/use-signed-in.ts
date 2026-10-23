"use client";

import { useEffect, useState } from "react";

let sessionPromise: Promise<boolean> | null = null;

function readSession(): Promise<boolean> {
  if (!sessionPromise) {
    sessionPromise = import("@/lib/supabase/client").then(({ createClient }) =>
      createClient()
        .auth.getSession()
        .then(({ data }) => Boolean(data.session)),
    );
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
