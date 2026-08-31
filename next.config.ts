import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.MOE_NEXT_DIST_DIR || ".next",
  output: "standalone",
  serverExternalPackages: ["nanocodex"],
};

export default nextConfig;
