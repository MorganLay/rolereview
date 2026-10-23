import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";

function MdxH2(props: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      className="mt-8 font-serif text-2xl font-semibold tracking-tight text-ink"
      {...props}
    />
  );
}

function MdxP(props: ComponentPropsWithoutRef<"p">) {
  return (
    <p className="mt-4 text-base leading-relaxed text-ink first:mt-0" {...props} />
  );
}

function MdxUl(props: ComponentPropsWithoutRef<"ul">) {
  return <ul className="mt-4 list-disc space-y-2 pl-5 text-ink" {...props} />;
}

function MdxLi(props: ComponentPropsWithoutRef<"li">) {
  return <li className="leading-relaxed" {...props} />;
}

function MdxA(props: ComponentPropsWithoutRef<"a">) {
  return (
    <a
      className="text-pine underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine"
      {...props}
    />
  );
}

function MdxStrong(props: ComponentPropsWithoutRef<"strong">) {
  return <strong className="font-medium text-ink" {...props} />;
}

const components: MDXComponents = {
  h2: MdxH2,
  p: MdxP,
  ul: MdxUl,
  li: MdxLi,
  a: MdxA,
  strong: MdxStrong,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
