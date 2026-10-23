"use client";

import { useEffect } from "react";

import { strings } from "@/copy/strings";

import "./globals.css";

const copy = strings.errors.unexpected;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("root error", { digest: error.digest });
  }, [error.digest]);

  return (
    <html lang="en">
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink antialiased">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <p className="font-serif text-lg font-semibold">{strings.brand.name}</p>
          <h1 className="mt-4 font-serif text-3xl font-semibold">{copy.title}</h1>
          <p className="mt-3 text-slate">{copy.body}</p>
          <button
            type="button"
            className="mt-6 min-h-11 rounded-button bg-pine px-4 text-sm font-medium text-paper"
            onClick={reset}
          >
            {copy.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
