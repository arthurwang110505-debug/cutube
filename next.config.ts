import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The preview runs behind Arena's HTTPS proxy; API requests remain same-origin.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.e2b.app"],
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
