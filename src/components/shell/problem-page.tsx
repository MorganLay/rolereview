import type { ReactNode } from "react";

type ProblemPageProps = {
  title: string;
  body: string;
  actions: ReactNode;
};

/** Shared layout for 404 and unexpected-error screens. */
export function ProblemPage({ title, body, actions }: ProblemPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-serif text-3xl font-semibold text-ink">{title}</h1>
      <p className="mt-3 text-slate">{body}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{actions}</div>
    </div>
  );
}
