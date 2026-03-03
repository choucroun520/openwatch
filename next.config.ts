import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["child_process"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent Turbopack/webpack from trying to bundle child_process spawn targets
      config.externals = [...(config.externals || []), "child_process"];
    }
    return config;
  },
};

export default nextConfig;
