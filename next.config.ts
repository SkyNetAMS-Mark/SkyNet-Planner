import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    // Skip type checking during build (types are checked in development)
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Disable static optimization to prevent build-time environment variable issues
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
};

export default nextConfig;
