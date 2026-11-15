import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // A second build folder lets a production build be tried while `next dev` runs.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
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
