import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Allow Cursor browser / 127.0.0.1 to load /_next assets in dev. */
  allowedDevOrigins: ["127.0.0.1"],
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
