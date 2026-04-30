import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.nps.gov",
        pathname: "/common/uploads/**",
      },
    ],
    minimumCacheTTL: 60,
  },
  experimental: {
    optimizePackageImports: [
      "@phosphor-icons/react",
      "@tanstack/react-virtual",
      "nuqs",
    ],
    preloadEntriesOnStart: false,
    proxyTimeout: 30000,
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: true,
  },
};

export default nextConfig;
