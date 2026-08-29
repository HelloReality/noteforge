import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    // Do not run ESLint during builds — the local `bun run lint` is the
    // source of truth for lint, and build-time lint can fail the Vercel
    // build on warnings.
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
