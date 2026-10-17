"use client";

import { useEffect } from "react";

import { setTimezone } from "@/features/account/actions";

const STORAGE_KEY = "rr_tz_captured";

/** Sends the browser IANA timezone once per browser (first app load). */
export function TimezoneCapture() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!timezone) return;
      sessionStorage.setItem(STORAGE_KEY, "1");
      void setTimezone({ timezone });
    } catch {
      // Private mode / blocked storage — skip; default America/Toronto remains.
    }
  }, []);

  return null;
}
