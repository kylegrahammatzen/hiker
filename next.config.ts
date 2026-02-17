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
  },
};

export default nextConfig;
