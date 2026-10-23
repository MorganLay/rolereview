import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  /* Allow Cursor browser / 127.0.0.1 to load /_next assets in dev. */
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@react-pdf/renderer", "docx"],
  outputFileTracingIncludes: {
    "/api/resumes/[resumeId]/pdf": ["./src/lib/pdf/fonts/**/*"],
  },
  experimental: {
    serverActions: {
      // Resumes are allowed up to 5 MB. The default action body limit is 1 MB.
      bodySizeLimit: "6mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withMDX = createMDX({
  extension: /\.mdx$/,
});

export default withMDX(nextConfig);
