import { strings } from "@/copy/strings";

type PlaceholderPageProps = {
  title: string;
  body?: string;
};

export function PlaceholderPage({ title, body }: PlaceholderPageProps) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-slate">
        {body ?? strings.shell.placeholderBody}
      </p>
    </div>
  );
}
