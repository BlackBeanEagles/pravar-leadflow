import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  agentRules: false,
  distDir: "build",
  experimental: { cpus: 1 },
};

export default nextConfig;
