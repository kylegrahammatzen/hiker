import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
