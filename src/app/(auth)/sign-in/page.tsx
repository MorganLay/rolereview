import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { strings } from "@/copy/strings";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/supabase/redirect";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: strings.signIn.title,
  description: strings.signIn.subtitle,
  robots: { index: false, follow: false },
};

/** Session check + searchParams — not an instant static shell. */
export const instant = false;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect(next);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-paper px-6 py-16 text-ink">
      <main className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <Link
            href="/"
            className="font-serif text-2xl font-semibold tracking-tight text-ink"
          >
            {strings.brand.name}
          </Link>
          <h1 className="text-lg font-medium">{strings.signIn.title}</h1>
          <p className="text-sm text-slate">{strings.signIn.subtitle}</p>
        </div>
        <SignInForm next={next} error={params.error} />
      </main>
    </div>
  );
}
