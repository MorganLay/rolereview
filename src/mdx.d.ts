declare module "*.mdx" {
  import type { ComponentType } from "react";

  export const meta: {
    title: string;
    date: string;
  };

  const MDXContent: ComponentType;
  export default MDXContent;
}
