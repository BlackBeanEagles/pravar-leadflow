import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  agentRules: false,
  distDir: "build",
};

export default nextConfig;
