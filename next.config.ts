import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Allow Cursor browser / 127.0.0.1 to load /_next assets in dev. */
  allowedDevOrigins: ["127.0.0.1"],
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

export default nextConfig;
